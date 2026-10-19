import type { SupabaseClient } from "@supabase/supabase-js";
import { today } from "./dates";

// If the embed function isn't deployed, stop trying for this server instance and use word search.
let embedUnavailable = false;

async function embed(supabase: SupabaseClient, text: string): Promise<number[] | null> {
  if (embedUnavailable || !text.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("embed", { body: { input: text } });
    if (error || !Array.isArray(data?.embedding)) {
      embedUnavailable = true;
      return null;
    }
    return data.embedding as number[];
  } catch {
    embedUnavailable = true;
    return null;
  }
}

/** Store something you wrote or did in long-term memory. Best-effort: never blocks or breaks the app. */
export async function remember(supabase: SupabaseClient, sourceType: string, sourceId: string, content: string, day?: string | null) {
  try {
    const text = content.trim();
    if (!text) return;
    const embedding = await embed(supabase, text);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("memory").upsert(
      {
        user_id: auth.user.id,
        source_type: sourceType,
        source_id: sourceId,
        content: text.slice(0, 6000),
        day: day ?? today(),
        ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
      },
      { onConflict: "user_id,source_type,source_id" }
    );
  } catch (e) {
    console.error("remember failed", e);
  }
}

export async function forget(supabase: SupabaseClient, sourceType: string, sourceId: string) {
  await supabase.from("memory").delete().eq("source_type", sourceType).eq("source_id", sourceId);
}

/** The memories most relevant to a question, from before a given day (so they add something beyond recent context). */
export async function recall(supabase: SupabaseClient, query: string, opts: { count?: number; beforeDay?: string } = {}) {
  try {
    const embedding = await embed(supabase, query);
    const { data } = await supabase.rpc("match_memory", {
      query_text: query,
      query_embedding: embedding ? JSON.stringify(embedding) : null,
      match_count: opts.count ?? 8,
      before_day: opts.beforeDay ?? null,
    });
    return (data ?? []) as { source_type: string; day: string; content: string; score: number }[];
  } catch {
    return [];
  }
}

/** Index everything that isn't in memory yet — run during the weekly learning pass. */
export async function backfillMemory(supabase: SupabaseClient, limit = 60) {
  const { data: have } = await supabase.from("memory").select("source_type, source_id");
  const seen = new Set((have ?? []).map((m) => `${m.source_type}:${m.source_id}`));
  const [journal, visions, tasks] = await Promise.all([
    supabase.from("journal_entries").select("id, day, prompt, body"),
    supabase.from("visions").select("id, title, body, horizon"),
    supabase.from("tasks").select("id, title, status, day").in("status", ["done", "skipped"]),
  ]);
  const todo: [string, string, string, string | null][] = [
    ...(journal.data ?? []).map((j) => ["journal", j.id, journalText(j), j.day] as [string, string, string, string]),
    ...(visions.data ?? []).map((v) => ["vision", v.id, `Vision (${v.horizon}): ${v.title}. ${v.body}`, null] as [string, string, string, null]),
    ...(tasks.data ?? []).map((t) => ["task", t.id, `${t.status === "done" ? "Did" : "Skipped"}: ${t.title}`, t.day] as [string, string, string, string]),
  ].filter(([type, id]) => !seen.has(`${type}:${id}`));
  for (const [type, id, text, day] of todo.slice(0, limit)) await remember(supabase, type, id, text, day);
}

export function journalText(j: { prompt?: string | null; body: string }) {
  return `${j.prompt ? `Prompt: ${j.prompt}\n` : ""}Journal: ${j.body}`;
}
