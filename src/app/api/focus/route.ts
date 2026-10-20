import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ask, buildContext } from "@/lib/ai";
import { ensureConversation, touchConversation } from "@/lib/conversations";
import { shortDay, today } from "@/lib/dates";

export const maxDuration = 120;

/** Process of elimination: what to keep, what to pause, what to drop. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  try {
    const context = await buildContext(supabase, { journalCount: 15, query: "what is working, what is not, energy, avoiding, income" });
    const prompt = `Run a focus review using process of elimination.
1. For each active project and idea in play, give a one-line verdict — keep, pause, or eliminate — based on evidence: what he actually did, what he skipped, what lit him up in the journal, and how close it is to income.
2. Name the one path most likely to get him to sustainable income in the next 90 days, and why.
3. Name the single thing to stop doing.
4. Ask him one question that would settle the biggest open uncertainty.
Be honest and brief. If the record is too thin to judge something, say so instead of guessing.`;
    const reply = await ask({ messages: [{ role: "user", content: `${context}\n\n---\n\n${prompt}` }], maxTokens: 4000 });
    const { conversationId } = await req.json().catch(() => ({}));
    const convId = await ensureConversation(supabase, conversationId, `Focus review, ${shortDay(today())}`);
    const conv = convId ? { conversation_id: convId } : {};
    const { data: rows } = await supabase
      .from("messages")
      .insert([
        { role: "user", content: "Run a focus review.", kind: "focus_review", ...conv },
        { role: "assistant", content: reply, kind: "focus_review", ...conv },
      ])
      .select("created_at");
    await touchConversation(supabase, convId);
    return NextResponse.json({ reply, conversationId: convId, repliedAt: rows?.[1]?.created_at ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
