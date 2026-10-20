import type { SupabaseClient } from "@supabase/supabase-js";
import { today } from "./dates";

// If the embed function isn't deployed, stop trying for a while and use word search; check again later.
let embedUnavailableUntil = 0;

async function embed(supabase: SupabaseClient, text: string): Promise<number[] | null> {
  if (Date.now() < embedUnavailableUntil || !text.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke("embed", { body: { input: text } });
    if (error || !Array.isArray(data?.embedding)) {
      embedUnavailableUntil = Date.now() + 10 * 60_000;
      return null;
    }
    return data.embedding as number[];
  } catch {
    embedUnavailableUntil = Date.now() + 10 * 60_000;
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
    const row = {
      user_id: auth.user.id,
      source_type: sourceType,
      source_id: sourceId,
      content: text.slice(0, 6000),
      day: day ?? today(),
      ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
    };
    const { error } = await supabase.from("memory").upsert({ ...row, part: 0 }, { onConflict: "user_id,source_type,source_id,part" });
    // Before the doc-passages migration runs, memory has one row per source.
    if (error) await supabase.from("memory").upsert(row, { onConflict: "user_id,source_type,source_id" });
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
    ...(visions.data ?? []).map((v) => ["vision", v.id, `Vision: ${v.title}. ${(v.body ?? "").replace(/<[^>]+>/g, " ")}`, null] as [string, string, string, null]),
    ...(tasks.data ?? []).map((t) => ["task", t.id, `${t.status === "done" ? "Did" : "Skipped"}: ${t.title}`, t.day] as [string, string, string, string]),
  ].filter(([type, id]) => !seen.has(`${type}:${id}`));
  for (const [type, id, text, day] of todo.slice(0, limit)) await remember(supabase, type, id, text, day);
}

export function journalText(j: { prompt?: string | null; body: string }) {
  return `${j.prompt ? `Prompt: ${j.prompt}\n` : ""}Journal: ${j.body}`;
}

/** Give older memories (saved before the embed function existed) their meaning fingerprint, a batch at a time. */
export async function embedMissing(supabase: SupabaseClient, limit = 40) {
  const { data: rows, error } = await supabase.from("memory").select("id, content").is("embedding", null).limit(limit);
  if (error || !rows?.length) return 0;
  let done = 0;
  for (const r of rows) {
    const embedding = await embed(supabase, r.content);
    if (!embedding) break; // function not deployed yet
    await supabase.from("memory").update({ embedding: JSON.stringify(embedding) }).eq("id", r.id);
    done++;
  }
  return done;
}

/** Drop memories of projects and tasks that have since been deleted, so the partner stops recalling them. */
export async function pruneMemory(supabase: SupabaseClient) {
  for (const [type, table] of [["project", "projects"], ["task", "tasks"]] as const) {
    const { data: mem } = await supabase.from("memory").select("source_id").eq("source_type", type).limit(300);
    const ids = (mem ?? []).map((m) => m.source_id as string);
    if (!ids.length) continue;
    const { data: live } = await supabase.from(table).select("id").in("id", ids);
    const keep = new Set((live ?? []).map((r) => r.id));
    const gone = ids.filter((id) => !keep.has(id));
    if (gone.length) await supabase.from("memory").delete().eq("source_type", type).in("source_id", gone);
  }
}

/** Split a doc into passages of about a page, each labelled with the doc and the nearest heading above it. */
export function passagesOf(title: string, text: string, size = 1500) {
  const out: string[] = [];
  let heading = "";
  let buf = "";
  const flush = () => {
    const body = buf.trim();
    if (body) out.push(`Doc "${title}"${heading ? ` — ${heading}` : ""}: ${body}`);
    buf = "";
  };
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    // A short line on its own reads as a heading (tab names come in as "## Tab").
    const h = p.replace(/^#+\s*/, "");
    if (p.length < 80 && !/[.!?,;:]$/.test(p) && !p.includes("\n")) {
      flush();
      heading = h;
      continue;
    }
    if (buf.length + p.length > size) flush();
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) {
        buf = p.slice(i, i + size);
        flush();
      }
    } else buf += (buf ? "\n\n" : "") + p;
  }
  flush();
  return out;
}

/**
 * Keep a whole doc in long-term memory as passages, so any part of it can be found when it matters.
 * Meaning fingerprints are added in the background (a batch at a time), so even a long doc saves quickly.
 */
export async function rememberDoc(supabase: SupabaseClient, docId: string, title: string, text: string, sourceType = "doc") {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const parts = passagesOf(title, text);
    if (!parts.length) return;
    await supabase.from("memory").delete().eq("source_type", sourceType).eq("source_id", docId);
    const rows = parts.map((content, part) => ({ user_id: auth.user!.id, source_type: sourceType, source_id: docId, part, content: content.slice(0, 6000), day: today() }));
    let failed = false;
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("memory").insert(rows.slice(i, i + 200));
      if (error) {
        failed = true;
        break;
      }
    }
    // Before the doc-passages migration runs, keep the doc's opening as one memory, as before.
    if (failed) {
      await supabase.from("memory").delete().eq("source_type", sourceType).eq("source_id", docId);
      await remember(supabase, sourceType, docId, `Doc "${title}": ${text.slice(0, 5000)}`);
      return;
    }
    await embedMissing(supabase, 60);
  } catch (e) {
    console.error("rememberDoc failed", e);
  }
}

/** The passages from your docs that best match what's being asked or planned. */
export async function recallDocs(supabase: SupabaseClient, query: string, count = 6) {
  try {
    const embedding = await embed(supabase, query);
    const { data, error } = await supabase.rpc("match_docs", { query_text: query, query_embedding: embedding ? JSON.stringify(embedding) : null, match_count: count });
    if (error) return [];
    return (data ?? []) as { content: string; score: number }[];
  } catch {
    return [];
  }
}

/** Docs saved before passages existed are re-read into passages, a few at a time. */
export async function indexDocs(supabase: SupabaseClient, limit = 3) {
  const { data: docs } = await supabase.from("context_docs").select("id, title, text").order("updated_at", { ascending: false });
  let done = 0;
  for (const d of docs ?? []) {
    if (done >= limit) break;
    const expected = passagesOf(d.title, d.text ?? "").length;
    if (expected <= 1) continue;
    const { count, error } = await supabase.from("memory").select("id", { count: "exact", head: true }).eq("source_type", "doc").eq("source_id", d.id);
    if (error) return;
    if ((count ?? 0) >= expected) continue;
    await rememberDoc(supabase, d.id, d.title, d.text ?? "");
    done++;
  }
}
