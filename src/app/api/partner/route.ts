import { NextResponse, after } from "next/server";
import { remember, pruneMemory, indexDocs, embedMissing } from "@/lib/memory";
import { movesFromChat } from "@/lib/moves";
import { createClient } from "@/lib/supabase/server";
import { ask, buildContext, PARTNER } from "@/lib/ai";
import { ensureConversation, touchConversation } from "@/lib/conversations";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { message, conversationId } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  // Each conversation is its own thread. Before the conversations migration runs, everything stays in one.
  const convId = await ensureConversation(supabase, conversationId, message);
  const conv = convId ? { conversation_id: convId } : {};
  const { data: saved } = await supabase.from("messages").insert({ role: "user", content: message.trim(), ...conv }).select("id, created_at").single();
  // What you tell your partner becomes long-term memory too.
  if (saved && message.trim().length > 40) after(() => remember(supabase, "chat", saved.id, `Told the partner: ${message.trim()}`));
  // "I sold two bowls at the market" counts as a move without logging it anywhere.
  if (saved) after(() => movesFromChat(supabase, { id: saved.id, text: message.trim() }));

  await pruneMemory(supabase).catch(() => {});
  const [context, history] = await Promise.all([
    buildContext(supabase, { query: message }),
    (convId ? supabase.from("messages").select("role, content").eq("conversation_id", convId) : supabase.from("messages").select("role, content"))
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of (history.data ?? []).reverse() as typeof turns) {
    const prev = turns[turns.length - 1];
    if (prev?.role === m.role) prev.content += "\n\n" + m.content; // merge back-to-back turns
    else turns.push({ ...m });
  }
  // The API needs the conversation to start with a user turn.
  while (turns.length && turns[0].role !== "user") turns.shift();

  try {
    const reply = await ask({
      system: `${PARTNER}\n\nThis is a conversation in the Partner tab. Earlier conversations aren't shown here, but what matters from them is in long-term memory below. The current context below is the truth right now: if earlier messages, his docs or memories mention projects, tasks or goals that aren't in the live lists, he has deleted them. Don't treat them as current or bring them back unless he does. Keep replies short unless he asks for depth. If he decides something, offer to turn it into a task or goal by naming it exactly.\n\n# Current context\n${context}`,
      messages: turns,
      maxTokens: 2500,
    });
    const { data: answer } = await supabase.from("messages").insert({ role: "assistant", content: reply, ...conv }).select("created_at").single();
    await touchConversation(supabase, convId);
    // Keep your docs fully searchable: re-read older ones into passages and add their meaning, a little each time.
    after(async () => {
      await indexDocs(supabase, 2).catch(() => {});
      await embedMissing(supabase, 40).catch(() => {});
    });
    return NextResponse.json({ reply, conversationId: convId, sentAt: saved?.created_at ?? null, repliedAt: answer?.created_at ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
