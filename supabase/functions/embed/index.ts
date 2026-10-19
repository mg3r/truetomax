// Turns text into an embedding with Supabase's built-in gte-small model (no API key, no cost).
// Deploy: supabase functions deploy embed
// truetomax works without it (it falls back to word search); with it, memory search understands meaning.

// @ts-expect-error Supabase Edge Runtime global
const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const { input } = await req.json();
  if (typeof input !== "string" || !input.trim()) {
    return new Response(JSON.stringify({ error: "input must be non-empty text" }), { status: 400 });
  }
  const embedding = await session.run(input.slice(0, 4000), { mean_pool: true, normalize: true });
  return new Response(JSON.stringify({ embedding }), { headers: { "Content-Type": "application/json" } });
});
