const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

  const { text, section, targetRole } = await req.json();
  if (!text?.trim()) return json({ error: "text is required" }, 400);

  const roleContext = targetRole ? ` The candidate is targeting the role of: ${targetRole}.` : "";

  const prompts: Record<string, string> = {
    summary: `Rewrite this professional summary for a CV to be more compelling and professional.${roleContext} Keep it 2-3 sentences. Return ONLY the rewritten text, nothing else:\n\n${text}`,
    experience: `Rewrite this work experience bullet point or description to be more professional and impactful for a CV.${roleContext} Use action verbs and quantify results where possible. Return ONLY the rewritten text:\n\n${text}`,
    skills: `Expand and improve this skills list for a CV.${roleContext} Format as a clean comma-separated list. Return ONLY the skills list:\n\n${text}`,
    default: `Improve this CV text to be more professional and impactful.${roleContext} Return ONLY the improved text:\n\n${text}`,
  };

  const prompt = prompts[section] || prompts.default;

  const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!aiRes.ok) return json({ error: "AI request failed" }, 500);

  const result = await aiRes.json();
  const improved = result.content?.[0]?.text?.trim() ?? "";

  return json({ improved });
});
