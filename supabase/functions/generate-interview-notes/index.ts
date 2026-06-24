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
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY is not configured. Add it to your Supabase edge function secrets." }, 500);
  }

  let body: { transcript: string; candidateName?: string; jobTitle?: string; applicationId?: string; interviewDate?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { transcript, candidateName, jobTitle, applicationId, interviewDate } = body;
  if (!transcript || transcript.trim().length < 50) {
    return json({ error: "Transcript is too short to generate meaningful notes." }, 400);
  }

  const prompt = `You are an expert recruitment consultant. Analyze this interview transcript and extract structured information.

INTERVIEW DETAILS:
Candidate: ${candidateName || "Unknown"}
Position: ${jobTitle || "Unknown"}
Date: ${interviewDate || new Date().toISOString().split("T")[0]}

TRANSCRIPT:
${transcript.slice(0, 12000)}

Respond with ONLY a valid JSON object — no markdown, no backticks, no commentary. Use this exact schema:
{
  "summary": "2-3 paragraph professional summary of the interview and candidate",
  "key_points": ["point 1", "point 2"],
  "skills": ["skill 1", "skill 2"],
  "qualifications": ["qualification 1"],
  "experience": ["experience 1", "experience 2"],
  "strengths": ["strength 1", "strength 2"],
  "concerns": ["concern 1"],
  "action_items": ["action 1", "action 2"],
  "recommendation": "Overall recommendation sentence or two",
  "salary_expectations": "Salary info if mentioned, otherwise: Not discussed",
  "availability": "Availability or notice period if mentioned, otherwise: Not discussed",
  "score_communication": 80,
  "score_technical": 85,
  "score_experience_relevance": 88,
  "score_confidence": 78,
  "score_overall": 83
}

All scores are integers 0–100. Base every answer strictly on the transcript.`;

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (err) {
    return json({ error: "Failed to reach Anthropic API", details: String(err) }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return json({ error: "Anthropic API error", details: errText }, 500);
  }

  const aiResult = await anthropicRes.json();
  const rawContent: string = aiResult.content?.[0]?.text ?? "";

  let notes: Record<string, unknown>;
  try {
    notes = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Could not parse AI response as JSON" }, 500);
    try { notes = JSON.parse(match[0]); }
    catch { return json({ error: "Malformed JSON in AI response" }, 500); }
  }

  // Persist to database using service role (bypasses RLS)
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: saved, error: dbErr } = await db
    .from("interview_ai_notes")
    .insert({
      application_id: applicationId || null,
      created_by: userId,
      interview_date: interviewDate ?? null,
      candidate_name: candidateName ?? null,
      job_title: jobTitle ?? null,
      transcript,
      summary:                   notes.summary ?? null,
      key_points:                notes.key_points ?? [],
      skills:                    notes.skills ?? [],
      qualifications:            notes.qualifications ?? [],
      experience:                notes.experience ?? [],
      strengths:                 notes.strengths ?? [],
      concerns:                  notes.concerns ?? [],
      action_items:              notes.action_items ?? [],
      recommendation:            notes.recommendation ?? null,
      salary_expectations:       notes.salary_expectations ?? "Not discussed",
      availability:              notes.availability ?? "Not discussed",
      score_communication:       notes.score_communication ?? null,
      score_technical:           notes.score_technical ?? null,
      score_experience_relevance: notes.score_experience_relevance ?? null,
      score_confidence:          notes.score_confidence ?? null,
      score_overall:             notes.score_overall ?? null,
    })
    .select("id")
    .single();

  if (dbErr) console.error("DB insert error:", dbErr.message);

  return json({ notes: { ...notes, id: saved?.id ?? null } });
});
