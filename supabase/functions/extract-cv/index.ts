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

// Extract plain text from a DOCX file (ZIP with word/document.xml)
async function docxToText(bytes: Uint8Array): Promise<string> {
  try {
    // DOCX is a ZIP — find word/document.xml
    // We look for the PK signature and scan for the XML part
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const raw = decoder.decode(bytes);
    const xmlStart = raw.indexOf("<w:body");
    const xmlEnd   = raw.indexOf("</w:body>");
    if (xmlStart === -1 || xmlEnd === -1) return raw.replace(/[^\x20-\x7E\n]/g, " ");
    const xmlSlice = raw.slice(xmlStart, xmlEnd + 9);
    // Strip XML tags
    return xmlSlice.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const userId = await getUserId(req);
  if (!userId) return json({ error: "Unauthorized" }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const { fileId, storageBucket, storagePath, mimeType } = await req.json();
  if (!storagePath) return json({ error: "storagePath is required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Download file from storage
  const { data: fileData, error: dlErr } = await db.storage
    .from(storageBucket || "seeker-cvs")
    .download(storagePath);
  if (dlErr || !fileData) return json({ error: "Failed to download CV file" }, 500);

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  // Build Claude message with the CV content
  const isPdf = mimeType === "application/pdf" || storagePath.toLowerCase().endsWith(".pdf");
  const isDocx = mimeType?.includes("wordprocessingml") || storagePath.toLowerCase().endsWith(".docx");

  const extractionPrompt = `You are an expert HR analyst. Extract ALL information from this CV/resume.

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "first_name": "...",
  "last_name": "...",
  "email": "...",
  "phone": "...",
  "location": "...",
  "job_titles": ["most recent title", "previous title"],
  "skills": ["skill1", "skill2"],
  "qualifications": ["qualification1"],
  "certifications": ["cert1"],
  "industries": ["industry1"],
  "languages": ["English", "Zulu"],
  "driver_licence": true,
  "years_experience": 5,
  "salary_expectations": "R25 000 per month or Not mentioned",
  "availability": "Immediately or 1 month notice or Not mentioned",
  "cv_text": "Full cleaned text of the entire CV",
  "ai_summary": "2-sentence professional summary of this candidate"
}

Extract exact information from the CV. For years_experience: calculate from work history dates. For skills: list ALL technical and soft skills mentioned.`;

  let anthropicBody: object;

  if (isPdf) {
    const base64 = btoa(String.fromCharCode(...bytes));
    anthropicBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: extractionPrompt },
        ],
      }],
    };
  } else if (isDocx) {
    const text = await docxToText(bytes);
    anthropicBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{
        role: "user",
        content: `Here is the CV text content:\n\n${text.slice(0, 10000)}\n\n${extractionPrompt}`,
      }],
    };
  } else {
    return json({ error: "Unsupported file type. Use PDF or DOCX." }, 400);
  }

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return json({ error: "Anthropic API error", details: err }, 500);
  }

  const aiResult = await aiRes.json();
  const rawContent: string = aiResult.content?.[0]?.text ?? "";

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "Could not parse AI extraction result" }, 500);
    try { extracted = JSON.parse(match[0]); }
    catch { return json({ error: "Malformed AI response" }, 500); }
  }

  // Build the name from extracted first/last
  const extractedName = [extracted.first_name, extracted.last_name].filter(Boolean).join(" ").trim();

  // Update profile with extracted data
  const updatePayload: Record<string, unknown> = {
    cv_text:               extracted.cv_text ?? null,
    cv_ai_summary:         extracted.ai_summary ?? null,
    cv_job_titles:         Array.isArray(extracted.job_titles) ? extracted.job_titles : [],
    cv_qualifications:     Array.isArray(extracted.qualifications) ? extracted.qualifications : [],
    cv_certifications:     Array.isArray(extracted.certifications) ? extracted.certifications : [],
    cv_industries:         Array.isArray(extracted.industries) ? extracted.industries : [],
    cv_languages:          Array.isArray(extracted.languages) ? extracted.languages : [],
    cv_driver_licence:     extracted.driver_licence ?? null,
    cv_years_experience:   typeof extracted.years_experience === "number" ? extracted.years_experience : null,
    cv_salary_expectations: String(extracted.salary_expectations || ""),
    cv_availability:       String(extracted.availability || ""),
    cv_extracted_at:       new Date().toISOString(),
    has_cv:                true,
    updated_at:            new Date().toISOString(),
  };

  // Merge skills — combine existing skills with newly extracted ones (deduplicated)
  const { data: existingProfile } = await db.from("profiles").select("skills, headline, summary, name").eq("id", userId).single();
  const existingSkills: string[] = Array.isArray(existingProfile?.skills) ? existingProfile.skills : [];
  const newSkills: string[] = Array.isArray(extracted.skills) ? extracted.skills as string[] : [];
  const mergedSkills = Array.from(new Set([...existingSkills, ...newSkills]));
  updatePayload.skills = mergedSkills;

  // Populate headline with most recent job title if empty
  if (!existingProfile?.headline && Array.isArray(extracted.job_titles) && extracted.job_titles.length > 0) {
    updatePayload.headline = String(extracted.job_titles[0]);
  }

  // Populate summary with AI summary if empty
  if (!existingProfile?.summary && extracted.ai_summary) {
    updatePayload.summary = String(extracted.ai_summary);
  }

  // Update location if extracted and not set
  if (extracted.location) updatePayload.location = String(extracted.location);
  if (extracted.phone)    updatePayload.phone    = String(extracted.phone);

  const { error: updateErr } = await db.from("profiles").update(updatePayload).eq("id", userId);
  if (updateErr) return json({ error: "Failed to save extracted data", details: updateErr.message }, 500);

  // Mark the cv_file record with extraction timestamp
  if (fileId) {
    await db.from("cv_files").update({ updated_at: new Date().toISOString() }).eq("id", fileId).eq("seeker_id", userId);
  }

  return json({ success: true, extracted: { name: extractedName, skills: mergedSkills, summary: updatePayload.cv_ai_summary } });
});
