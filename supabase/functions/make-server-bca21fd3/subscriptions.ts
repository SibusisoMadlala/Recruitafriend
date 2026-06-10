import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_IDS = ["starter", "growth", "professional", "enterprise"] as const;
type PlanId = typeof PLAN_IDS[number];

const TRIAL_DAYS = 14;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function getEmployerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// POST /subscriptions/trial
export async function handleStartTrial(req: Request): Promise<Response> {
  const employerId = await getEmployerId(req);
  if (!employerId) return json({ error: "Unauthorized" }, 401);

  const db = adminClient();

  // Check for existing subscription
  const { data: existing } = await db
    .from("employer_subscriptions")
    .select("id, plan_id, status")
    .eq("employer_id", employerId)
    .maybeSingle();

  if (existing) {
    return json({ error: "Subscription already exists", subscription: existing.plan_id }, 400);
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const { data: sub, error } = await db
    .from("employer_subscriptions")
    .insert({
      employer_id: employerId,
      plan_id: "growth",          // trial unlocks Growth features
      billing_cycle: "monthly",
      status: "trialing",
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  await db.from("subscription_events").insert({
    employer_id: employerId,
    event_type: "started_trial",
    from_plan: null,
    to_plan: "growth",
    billing_cycle: "monthly",
  });

  return json({ subscription: "trial", trial_ends_at: trialEnd.toISOString(), data: sub });
}

// POST /subscriptions/change  body: { plan: "GROWTH", billing_cycle?: "monthly"|"annual" }
export async function handleChangePlan(req: Request): Promise<Response> {
  const employerId = await getEmployerId(req);
  if (!employerId) return json({ error: "Unauthorized" }, 401);

  let body: { plan?: string; billing_cycle?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const planId = (body.plan ?? "").toLowerCase() as PlanId;
  if (!PLAN_IDS.includes(planId)) {
    return json({ error: `Invalid plan. Valid plans: ${PLAN_IDS.join(", ")}` }, 400);
  }

  const billingCycle = body.billing_cycle === "annual" ? "annual" : "monthly";
  const db = adminClient();

  const { data: existing } = await db
    .from("employer_subscriptions")
    .select("id, plan_id, billing_cycle, status")
    .eq("employer_id", employerId)
    .maybeSingle();

  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "annual") {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const fromPlan = existing?.plan_id ?? null;

  let sub;
  if (existing) {
    const { data, error } = await db
      .from("employer_subscriptions")
      .update({
        plan_id: planId,
        billing_cycle: billingCycle,
        status: "active",
        trial_ends_at: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancelled_at: null,
      })
      .eq("employer_id", employerId)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    sub = data;
  } else {
    const { data, error } = await db
      .from("employer_subscriptions")
      .insert({
        employer_id: employerId,
        plan_id: planId,
        billing_cycle: billingCycle,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    sub = data;
  }

  await db.from("subscription_events").insert({
    employer_id: employerId,
    event_type: fromPlan ? "plan_changed" : "plan_selected",
    from_plan: fromPlan,
    to_plan: planId,
    billing_cycle: billingCycle,
  });

  return json({ subscription: planId, billing_cycle: billingCycle, data: sub });
}

// GET /subscriptions/current
export async function handleGetSubscription(req: Request): Promise<Response> {
  const employerId = await getEmployerId(req);
  if (!employerId) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await adminClient()
    .from("employer_subscriptions")
    .select(`
      *,
      plan:subscription_plans (
        id, name, price_month, price_year,
        listing_limit, application_limit, cv_search_limit,
        ats_kanban, video_assessments, advanced_analytics, api_access
      )
    `)
    .eq("employer_id", employerId)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ subscription: "starter", plan: null, status: "none" });

  return json({ subscription: data.plan_id, status: data.status, data });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
