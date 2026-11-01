// Worldsmith genome endpoint: text → genome JSON via Anthropic API.
// Secret: ANTHROPIC_API_KEY (set in Supabase dashboard). Public, CORS-open, rate-limited per IP.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const hits = new Map<string, number[]>();
function limited(ip: string) { const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < 60_000); a.push(now); hits.set(ip, a); return a.length > 30; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: CORS });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anon";
  if (limited(ip)) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...CORS, "content-type": "application/json" } });
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no_key" }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  let body: { prompt?: string };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "bad_json" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } }); }
  const prompt = String(body.prompt || "").slice(0, 12000);
  if (!prompt) return new Response(JSON.stringify({ error: "empty" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-5-5", max_tokens: 900, temperature: 0.9,
      system: "You output exactly one JSON object and nothing else.",
      messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) { const t = await r.text(); return new Response(JSON.stringify({ error: "upstream", status: r.status, detail: t.slice(0, 300) }), { status: 502, headers: { ...CORS, "content-type": "application/json" } }); }
  const data = await r.json();
  const text: string = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
  // tolerant JSON extraction: whole, fenced, or first { .. last }
  let json: unknown = null;
  try { json = JSON.parse(text); } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/); const s = m ? m[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    try { json = JSON.parse(s); } catch { /* leave null */ }
  }
  if (!json) return new Response(JSON.stringify({ error: "invalid_json", text: text.slice(0, 500) }), { status: 502, headers: { ...CORS, "content-type": "application/json" } });
  return new Response(JSON.stringify({ genome: json, usage: data.usage }), { headers: { ...CORS, "content-type": "application/json" } });
});
