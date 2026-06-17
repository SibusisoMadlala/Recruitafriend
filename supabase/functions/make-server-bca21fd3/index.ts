import { handleStartTrial, handleChangePlan, handleGetSubscription } from "./subscriptions.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const url = new URL(req.url);
  // Strip the function prefix: /functions/v1/make-server-bca21fd3/...
  const segments = url.pathname.split("/").filter(Boolean);
  // segments[0]='functions' [1]='v1' [2]='make-server-bca21fd3' [3+]=route
  const route = "/" + segments.slice(3).join("/");

  let response: Response;

  try {
    if (route === "/subscriptions/trial" && req.method === "POST") {
      response = await handleStartTrial(req);
    } else if (route === "/subscriptions/change" && req.method === "POST") {
      response = await handleChangePlan(req);
    } else if (route === "/subscriptions/current" && req.method === "GET") {
      response = await handleGetSubscription(req);
    } else {
      response = new Response(JSON.stringify({ error: "Not found", route }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Unhandled error:", err);
    response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Attach CORS headers to every response
  const headers = new Headers(response.headers);
  Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
});
