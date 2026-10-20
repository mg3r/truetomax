import { NextResponse, after } from "next/server";
import { remember } from "@/lib/memory";
import { createClient } from "@/lib/supabase/server";
import { ask, buildContext, PARTNER } from "@/lib/ai";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { message } = await req.json();
  if (!message?.trim()) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  const { data: saved } = await supabase.from("messages").insert({ role: "user", content: message.trim() }).select("id").single();
  // What you tell your partner becomes long-term memory too.
  if (saved && message.trim().length > 40) after(() => remember(supabase, "chat", saved.id, `Told the partner: ${message.trim()}`));

  const [context, history] = await Promise.all([
    buildContext(supabase, { query: message }),
    supabase.from("messages").select("role, content").order("created_at", { ascending: false }).limit(20),
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
      system: `${PARTNER}\n\nThis is a conversation in the Partner tab. Keep replies short unless he asks for depth. If he decides something, offer to turn it into a task or goal by naming it exactly.\n\n# Current context\n${context}`,
      messages: turns,
      maxTokens: 2500,
    });
    await supabase.from("messages").insert({ role: "assistant", content: reply });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
