// truetomax: turns text into a meaning fingerprint (embedding) with Supabase's built-in gte-small model.
// No API key, no cost. Deploy from the Supabase dashboard: Edge Functions → Deploy a new function → Via Editor,
// name it "embed", paste this file, Deploy.

// deno-lint-ignore no-explicit-any
const session = new (globalThis as any).Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const { input } = await req.json().catch(() => ({ input: null }));
  if (typeof input !== "string" || !input.trim()) {
    return new Response(JSON.stringify({ error: "input must be non-empty text" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const embedding = await session.run(input.slice(0, 4000), { mean_pool: true, normalize: true });
  return new Response(JSON.stringify({ embedding }), { headers: { "Content-Type": "application/json" } });
});
