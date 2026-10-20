import type { SupabaseClient } from "@supabase/supabase-js";
import { askJSON, buildContext } from "./ai";
import { addDays, today, WEEKDAYS, weekdayOf } from "./dates";
import { backfillMemory } from "./memory";

type T = { title: string; status: string; source: string; category: string | null; size: string | null; day: string | null; accepted_at: string | null };
type Tally = { offered: number; done: number; skipped: number };

const rate = (t: Tally) => (t.offered ? Math.round((t.done / t.offered) * 100) : 0);
function tally<K extends string>(rows: T[], key: (t: T) => K | null) {
  const out = new Map<K, Tally>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const t = out.get(k) ?? { offered: 0, done: 0, skipped: 0 };
    t.offered++;
    if (r.status === "done") t.done++;
    if (r.status === "skipped") t.skipped++;
    out.set(k, t);
  }
  return out;
}

/** What actually happened over the last six weeks: follow-through by kind of work, by day, and on your rhythm. */
export async function getStats(supabase: SupabaseClient, days = 42) {
  const end = today();
  const since = addDays(end, -days);
  const [tasks, moves] = await Promise.all([
    supabase.from("tasks").select("title, status, source, category, size, day, accepted_at").gte("day", since).lt("day", end),
    supabase.from("moves").select("kind, amount, day").gte("day", since),
  ]);
  const rows = (tasks.data ?? []) as T[];
  const partner = rows.filter((r) => r.source === "partner");
  const rhythm = rows.filter((r) => r.source === "rhythm");
  const mine = rows.filter((r) => r.source === "me");

  const accepted = partner.filter((r) => r.accepted_at || r.status === "done").length;
  const byCategory = tally(partner, (r) => r.category);
  const bySize = tally(partner, (r) => r.size);
  const byWeekday = tally(rows, (r) => (r.day ? WEEKDAYS[weekdayOf(r.day)] : null));
  const byRhythm = tally(rhythm, (r) => `${r.title} (${r.day ? WEEKDAYS[weekdayOf(r.day)].slice(0, 3) : "?"})`);

  const weeks = new Map<string, { shared: number; asked: number; booked: number; sold: number; money: number }>();
  for (let i = Math.ceil(days / 7) - 1; i >= 0; i--) weeks.set(addDays(end, -7 * i - 6), { shared: 0, asked: 0, booked: 0, sold: 0, money: 0 });
  for (const m of moves.data ?? []) {
    const key = [...weeks.keys()].filter((w) => w <= m.day).pop();
    if (!key) continue;
    const w = weeks.get(key)!;
    w[m.kind as "shared"] += 1;
    w.money += Number(m.amount ?? 0);
  }

  const fmt = (m: Map<string, Tally>) =>
    [...m.entries()].sort((a, b) => b[1].offered - a[1].offered).map(([k, t]) => `${k}: ${t.done}/${t.offered} done (${rate(t)}%), ${t.skipped} skipped`).join("; ") || "no data";

  const text = [
    `Partner suggestions: ${partner.length} offered, ${accepted} accepted, ${partner.filter((r) => r.status === "done").length} done.`,
    `By kind of work: ${fmt(byCategory)}.`,
    `By size: ${fmt(bySize)}.`,
    `Own tasks: ${mine.filter((r) => r.status === "done").length}/${mine.length} done.`,
    `By weekday (all tasks): ${fmt(byWeekday)}.`,
    `Weekly rhythm follow-through: ${fmt(byRhythm)}.`,
    `Moves per week (shared / asked / booked / sold / $): ${[...weeks.entries()].map(([w, v]) => `wk of ${w}: ${v.shared}/${v.asked}/${v.booked}/${v.sold}/$${v.money}`).join("; ")}.`,
  ].join("\n");

  return {
    text,
    data: {
      partner: { offered: partner.length, accepted, done: partner.filter((r) => r.status === "done").length },
      byCategory: Object.fromEntries(byCategory),
      byWeekday: Object.fromEntries(byWeekday),
      byRhythm: Object.fromEntries(byRhythm),
      weeks: Object.fromEntries(weeks),
      totalTasks: rows.length,
    },
  };
}

type LearnResult = {
  insights: { id?: string | null; statement: string; evidence: string; kind: string; confidence: number; action: "add" | "update" | "retire" }[];
  rhythm_proposals: { action: "add" | "remove" | "move"; rhythm_id?: string | null; title?: string | null; weekday?: number | null; to_weekday?: number | null; reason: string }[];
  policy: { max_suggestions: number; preferred_size: string; lean_into: string[]; ease_off: string[]; notes: string };
  summary: string;
  review: string;
};

const KINDS = ["pattern", "strength", "avoidance", "preference", "opportunity"];

/**
 * The weekly learning pass. Reads everything, compares it with what the partner believed,
 * and changes how the partner behaves: insights, suggestion policy, rhythm proposals, and a review for you.
 */
export async function learn(supabase: SupabaseClient) {
  await backfillMemory(supabase);
  const [stats, insights, rhythm, context] = await Promise.all([
    getStats(supabase),
    supabase.from("insights").select("id, statement, evidence, kind, confidence, status, your_note").neq("status", "retired"),
    supabase.from("rhythm").select("id, weekday, title"),
    buildContext(supabase, { journalCount: 25, skipLearned: true }),
  ]);

  const result = await askJSON<LearnResult>(
    `It's time for your weekly learning pass. Your job is to change how you guide Max based on what actually happened — not to summarize.

## Results (last 6 weeks, computed from the record)
${stats.text}

## What you currently believe
${(insights.data ?? []).map((i) => `- [${i.id}] (${i.status}, ${i.kind}, confidence ${i.confidence}) ${i.statement}${i.your_note ? ` — Max's note: ${i.your_note}` : ""}`).join("\n") || "(nothing yet)"}
Insights marked "confirmed" are Max's. You may update their confidence and evidence, never their statement. Insights marked "rejected" are wrong — do not re-propose them in any form.

## Weekly rhythm (id: weekday — title)
${(rhythm.data ?? []).map((r) => `- ${r.id}: ${WEEKDAYS[r.weekday]} — ${r.title}`).join("\n") || "(empty)"}

Return JSON:
{
  "insights": up to 8 changes. Each {"id": existing id when updating or retiring, else null, "statement": a specific, testable rule about how Max actually works (who, what, when) — not a platitude, "evidence": the numbers or entries behind it, "kind": one of ${KINDS.join("/")}, "confidence": 0-1 based on how much evidence there is, "action": "add" | "update" | "retire"}. Only claim what the record supports; with thin data, propose fewer, lower-confidence insights.
  "rhythm_proposals": up to 3 changes to the weekly rhythm justified by follow-through data — {"action": "add"|"remove"|"move", "rhythm_id": for remove/move, "title": for add, "weekday": 0-6 (0=Sunday) for add, "to_weekday": for move, "reason": one sentence with the evidence}. Propose nothing if the rhythm is working.
  "policy": how daily suggestions should change — {"max_suggestions": 1-3, "preferred_size": "small"|"medium", "lean_into": kinds of work or projects to push more, "ease_off": what to push less, "notes": one or two sentences of guidance to your future self}
  "summary": under 200 words, your current understanding of Max — what energizes him, what he avoids, the most viable income paths, what's been eliminated and why.
  "review": a short weekly note to Max in your voice (plain text, under 220 words): what you noticed this week with evidence, how many moves he made (shares and asks) versus last week, what you're changing about how you guide him and why, and one honest question.
}`,
    context,
    3500
  );

  const known = new Map((insights.data ?? []).map((i) => [i.id, i]));
  for (const i of result.insights ?? []) {
    const kind = KINDS.includes(i.kind) ? i.kind : "pattern";
    const confidence = Math.max(0, Math.min(1, Number(i.confidence) || 0.5));
    const existing = i.id ? known.get(i.id) : null;
    if (existing) {
      if (existing.status === "rejected") continue;
      if (i.action === "retire" && existing.status === "proposed") {
        await supabase.from("insights").update({ status: "retired", updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else if (existing.status === "confirmed") {
        await supabase.from("insights").update({ confidence, evidence: i.evidence, updated_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("insights").update({ statement: i.statement, evidence: i.evidence, kind, confidence, updated_at: new Date().toISOString() }).eq("id", existing.id);
      }
    } else if (i.action !== "retire" && i.statement) {
      await supabase.from("insights").insert({ statement: i.statement, evidence: i.evidence, kind, confidence });
    }
  }

  // Fresh proposals replace any you haven't answered yet.
  await supabase.from("rhythm_proposals").delete().eq("status", "proposed");
  const rhythmIds = new Set((rhythm.data ?? []).map((r) => r.id));
  const valid = (result.rhythm_proposals ?? []).filter((p) => {
    if (p.action === "add") return !!p.title && Number.isInteger(p.weekday);
    if (p.action === "remove") return !!p.rhythm_id && rhythmIds.has(p.rhythm_id);
    return !!p.rhythm_id && rhythmIds.has(p.rhythm_id) && Number.isInteger(p.to_weekday);
  });
  if (valid.length) {
    await supabase.from("rhythm_proposals").insert(
      valid.slice(0, 3).map((p) => ({
        action: p.action,
        rhythm_id: p.action === "add" ? null : p.rhythm_id,
        title: p.title ?? null,
        weekday: p.weekday ?? null,
        to_weekday: p.to_weekday ?? null,
        reason: p.reason,
      }))
    );
  }

  const now = new Date().toISOString();
  await supabase
    .from("profile_context")
    .update({ policy: result.policy ?? {}, summary: result.summary ?? "", summary_updated_at: now, last_learned_at: now })
    .not("user_id", "is", null);

  if (result.review) await supabase.from("reviews").insert({ week_of: today(), body: result.review, stats: stats.data });
}

/** Run the learning pass when a week has passed and there's enough new activity to learn from. */
export async function learnIfDue(supabase: SupabaseClient) {
  const { data: ctx } = await supabase.from("profile_context").select("last_learned_at, created_at").maybeSingle();
  if (!ctx) return;
  const last = ctx.last_learned_at ?? ctx.created_at;
  if (Date.now() - new Date(last).getTime() < 7 * 86400_000) return;
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["done", "skipped"]).gte("day", addDays(today(), -7));
  const { count: entries } = await supabase.from("journal_entries").select("id", { count: "exact", head: true }).gte("day", addDays(today(), -7));
  const { count: checks } = await supabase.from("routine_checks").select("routine_id", { count: "exact", head: true }).gte("day", addDays(today(), -7));
  if ((count ?? 0) + (entries ?? 0) + (checks ?? 0) < 5) return;
  // Claim this week's pass first so two open tabs don't both run it.
  await supabase.from("profile_context").update({ last_learned_at: new Date().toISOString() }).not("user_id", "is", null);
  try {
    await learn(supabase);
  } catch (e) {
    // Let it try again next time the day is prepared.
    await supabase.from("profile_context").update({ last_learned_at: last }).not("user_id", "is", null);
    throw e;
  }
}
