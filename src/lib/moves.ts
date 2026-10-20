import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "./ai";
import { remember } from "./memory";
import { today } from "./dates";

export type MoveKind = "shared" | "asked" | "booked" | "sold";
type Found = { kind: MoveKind; note: string; amount?: number | null };

const RULES = `A "move" is Max putting his work in front of people or asking to be paid. Kinds:
- shared: he showed his work to people (posted, sent, published, performed, exhibited, hosted something others saw).
- asked: he offered his work or asked someone to book, buy, hire or pay him (pitched, proposed, followed up on an offer, sent a quote).
- booked: someone committed to book or hire him.
- sold: money came in for his work.
Not moves: making, practicing, planning, prepping, buying supplies, admin, chores, or anything only intended and not done.`;

/** Recent corrections, so the partner learns how Max means things. */
async function corrections(supabase: SupabaseClient) {
  const { data } = await supabase.from("memory").select("content").eq("source_type", "move_fix").order("created_at", { ascending: false }).limit(12);
  return (data ?? []).map((m) => `- ${m.content}`).join("\n");
}

function parse(text: string): Found[] {
  const s = text.indexOf("[");
  const e = text.lastIndexOf("]");
  if (s < 0 || e < 0) return [];
  try {
    return (JSON.parse(text.slice(s, e + 1)) as Found[]).filter((m) => ["shared", "asked", "booked", "sold"].includes(m?.kind) && m.note);
  } catch {
    return [];
  }
}

async function detect(supabase: SupabaseClient, what: string, text: string): Promise<Found[]> {
  const fixes = await corrections(supabase);
  const reply = await ask({
    system: "You read short notes precisely and only report what actually happened.",
    maxTokens: 500,
    messages: [
      {
        role: "user",
        content: `${RULES}
${fixes ? `\nMax's corrections so far (follow them):\n${fixes}\n` : ""}
${what}:
"""
${text.slice(0, 6000)}
"""
List each move that actually happened, in his words, short. Include the dollar amount for booked or sold when stated. If none, return [].
Return only JSON: [{"kind": "shared"|"asked"|"booked"|"sold", "note": "...", "amount": number or null}]`,
      },
    ],
  });
  return parse(reply);
}

/** Replace the moves that came from one source (an action, a journal entry, a chat message) with what's there now. */
async function record(supabase: SupabaseClient, source: string, sourceId: string, found: Found[], extra: Record<string, unknown> = {}) {
  await supabase.from("moves").delete().eq("source", source).eq("source_id", sourceId);
  if (!found.length) return;
  const { data } = await supabase
    .from("moves")
    .insert(found.map((m) => ({ kind: m.kind, note: m.note.slice(0, 300), amount: m.amount ?? null, day: today(), source, source_id: sourceId, ...extra })))
    .select("id, kind, note, amount");
  for (const m of data ?? []) await remember(supabase, "move", m.id, `Move — ${m.kind}: ${m.note}${m.amount ? ` ($${m.amount})` : ""}`);
}

/** A finished action: was it a share or an ask? Undoing it takes the move back. */
export async function movesFromAction(supabase: SupabaseClient, task: { id: string; title: string; project_id?: string | null; day?: string | null }, done: boolean) {
  try {
    if (!done) {
      await supabase.from("moves").delete().eq("source", "action").eq("source_id", task.id);
      return;
    }
    const found = (await detect(supabase, "An action he just finished", task.title)).slice(0, 1);
    await record(supabase, "action", task.id, found, { task_id: task.id, project_id: task.project_id ?? null });
  } catch (e) {
    console.error("movesFromAction", e);
  }
}

/** A journal entry (new or edited): the moves it describes. */
export async function movesFromJournal(supabase: SupabaseClient, entry: { id: string; body: string }) {
  try {
    await record(supabase, "journal", entry.id, await detect(supabase, "His journal entry", entry.body));
  } catch (e) {
    console.error("movesFromJournal", e);
  }
}

/** Something he told the partner: the moves it describes. */
export async function movesFromChat(supabase: SupabaseClient, message: { id: string; text: string }) {
  try {
    if (message.text.trim().length < 15) return;
    await record(supabase, "chat", message.id, await detect(supabase, "Something he told his partner", message.text));
  } catch (e) {
    console.error("movesFromChat", e);
  }
}
