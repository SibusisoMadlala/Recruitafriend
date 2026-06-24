import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const { query } = await req.json();
  if (!query?.trim()) return json({ error: "query is required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Fetch seeker profiles that have CVs
  const { data: candidates, error } = await db
    .from("profiles")
    .select("id, name, headline, summary, cv_ai_summary, location, skills, cv_job_titles, cv_qualifications, cv_certifications, cv_years_experience, cv_industries, avatar_url")
    .eq("user_type", "seeker")
    .eq("has_cv", true)
    .limit(100);

  if (error) return json({ error: "Failed to fetch candidates" }, 500);
  if (!candidates?.length) return json({ results: [] });

  // Build a compact candidate list for Claude
  const candidateList = candidates.map((c, i) => {
    const skills = Array.isArray(c.skills) ? c.skills.join(", ") : "";
    const titles = Array.isArray(c.cv_job_titles) ? c.cv_job_titles.join(", ") : "";
    const quals  = Array.isArray(c.cv_qualifications) ? c.cv_qualifications.join(", ") : "";
    const certs  = Array.isArray(c.cv_certifications) ? c.cv_certifications.join(", ") : "";
    return `CANDIDATE ${i + 1} (id:${c.id}):
Name: ${c.name || "Unknown"}
Location: ${c.location || "Unknown"}
Headline: ${c.headline || ""}
Summary: ${c.cv_ai_summary || c.summary || ""}
Job Titles: ${titles}
Skills: ${skills}
Qualifications: ${quals}
Certifications: ${certs}
Years Experience: ${c.cv_years_experience ?? "Unknown"}`;
  }).join("\n\n---\n\n");

  const prompt = `You are an expert recruitment AI. A recruiter is searching for: "${query}"

Here are the available candidates:

${candidateList.slice(0, 20000)}

Score each candidate from 0-100 based on how well they match the search query.
Weight: job title match (high), skills match (high), qualifications (high), experience (medium), location (medium).

Return ONLY valid JSON (no markdown):
{
  "results": [
    {
      "id": "candidate-uuid",
      "match_score": 92,
      "explanation": "One sentence explaining why this candidate matches."
    }
  ]
}

Include ALL candidates that score above 30. Sort by match_score descending. Only include candidates that are at least a partial match.`;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return json({ error: "Anthropic API error", details: err }, 500);
  }

  const aiResult = await aiRes.json();
  const rawContent: string = aiResult.content?.[0]?.text ?? "";

  let parsed: { results: Array<{ id: string; match_score: number; explanation: string }> };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Could not parse AI response" }, 500);
    try { parsed = JSON.parse(match[0]); }
    catch { return json({ error: "Malformed AI response" }, 500); }
  }

  // Merge scores back with full candidate data
  const candidateMap = new Map(candidates.map(c => [c.id, c]));
  const enriched = (parsed.results || [])
    .filter(r => candidateMap.has(r.id))
    .map(r => ({ ...candidateMap.get(r.id), match_score: r.match_score, explanation: r.explanation }));

  return json({ results: enriched });
});
