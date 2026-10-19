import type { SupabaseClient } from "@supabase/supabase-js";
import { askJSON, buildContext, ask, PARTNER } from "./ai";
import { today, weekdayOf } from "./dates";
import { seedIfNeeded } from "./seed";

const FALLBACK_AFFIRMATIONS = [
  "I finish what I start, and I let it be seen.",
  "My work is worth sharing before it feels ready.",
  "I trust the practice; today I show up for it.",
  "The people who need what I make are looking for it.",
];

type DayPlan = {
  affirmation: string;
  question: string;
  focus: string;
  tasks: { title: string; project?: string; reason: string }[];
};

/** Prepare today once: weekly rhythm tasks, a saved passage, and the partner's affirmation, question and suggestions. */
export async function prepareDay(supabase: SupabaseClient, { force = false } = {}) {
  await seedIfNeeded(supabase);
  const day = today();

  if (force) {
    await supabase.from("days").delete().eq("day", day);
    await supabase.from("tasks").delete().eq("day", day).eq("status", "suggested");
  }

  // Claim the day first so two open tabs don't both prepare it.
  const { error: claimErr } = await supabase.from("days").insert({ day });
  if (claimErr) {
    // Already prepared, or being prepared. If an earlier attempt died halfway, start over.
    const { data: existing } = await supabase.from("days").select("affirmation, created_at").eq("day", day).maybeSingle();
    const stale = existing && !existing.affirmation && Date.now() - new Date(existing.created_at).getTime() > 90_000;
    if (!stale) return;
    await supabase.from("days").delete().eq("day", day);
    return prepareDay(supabase);
  }

  // 1. Weekly rhythm becomes today's fixed tasks.
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("day", day).eq("source", "rhythm");
  if (!count) {
    const { data: rhythm } = await supabase.from("rhythm").select("title, project_id").eq("weekday", weekdayOf(day)).order("sort");
    if (rhythm?.length) {
      await supabase.from("tasks").insert(rhythm.map((r) => ({ title: r.title, project_id: r.project_id, day, source: "rhythm" })));
    }
  }

  // 2. A passage from the highlights library — least recently shown first.
  const { data: hl } = await supabase
    .from("highlights")
    .select("id, text, source, times_shown")
    .order("times_shown", { ascending: true })
    .order("last_shown", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  if (hl) await supabase.from("highlights").update({ times_shown: hl.times_shown + 1, last_shown: day }).eq("id", hl.id);

  // 3. The partner's read on today.
  let plan: DayPlan | null = null;
  try {
    await refreshSummaryIfStale(supabase);
    const context = await buildContext(supabase);
    const { data: projects } = await supabase.from("projects").select("id, title").eq("status", "active");
    plan = await askJSON<DayPlan>(
      `Prepare Max's day.
${hl ? `Today's saved passage (from ${hl.source}, exact text he saved): "${hl.text}"` : "He hasn't saved any passages yet; draw the question from the themes of The Creative Act without quoting it."}

Return:
{
  "affirmation": one sentence in first person, specific to where he is right now, under 20 words,
  "question": one reflective journal question rooted in ${hl ? "the passage" : "a theme of The Creative Act"} and connected to what's actually happening in his life and work right now,
  "focus": one sentence naming the single thing that would make today count,
  "tasks": up to 3 suggested tasks that fit today's rhythm and move a vision forward — favor finishing, sharing, and getting paid. Each: {"title": short imperative with a clear definition of done, "project": exact project title from this list or omit [${(projects ?? []).map((p) => p.title).join(", ")}], "reason": one sentence on why today}
}
Don't repeat anything already open or skipped recently.`,
      context
    );
  } catch (e) {
    console.error("prepareDay: partner unavailable", e);
  }

  const { data: projects } = await supabase.from("projects").select("id, title");
  if (plan?.tasks?.length) {
    await supabase.from("tasks").insert(
      plan.tasks.slice(0, 3).map((t) => ({
        title: t.title,
        reason: t.reason,
        day,
        status: "suggested",
        source: "partner",
        project_id: projects?.find((p) => p.title === t.project)?.id ?? null,
      }))
    );
  }

  await supabase
    .from("days")
    .update({
      highlight_id: hl?.id ?? null,
      affirmation: plan?.affirmation ?? FALLBACK_AFFIRMATIONS[new Date().getDate() % FALLBACK_AFFIRMATIONS.length],
      question: plan?.question ?? "What would you make today if no one ever saw it — and what would you make if everyone did?",
      focus: plan?.focus ?? null,
    })
    .eq("day", day);
}

/** The partner's evolving read of Max, rewritten from everything he's logged. Runs at most weekly. */
export async function refreshSummaryIfStale(supabase: SupabaseClient, force = false) {
  const { data: ctx } = await supabase.from("profile_context").select("summary_updated_at").maybeSingle();
  const last = ctx?.summary_updated_at ? new Date(ctx.summary_updated_at).getTime() : 0;
  if (!force && Date.now() - last < 6 * 86400_000) return;

  const { count } = await supabase.from("journal_entries").select("id", { count: "exact", head: true });
  if (!force && (count ?? 0) < 3) return;

  const context = await buildContext(supabase, { journalCount: 30 });
  const summary = await ask({
    system: PARTNER,
    maxTokens: 900,
    messages: [
      {
        role: "user",
        content: `${context}\n\n---\n\nRewrite "What you have learned about Max so far" in under 250 words. Cover: what genuinely energizes him (with evidence), what he avoids or keeps skipping, which paths look most viable for income, what he has eliminated and why, and the patterns you'd watch for next. Only state what the record supports. Plain prose, no headings.`,
      },
    ],
  });
  await supabase.from("profile_context").update({ summary, summary_updated_at: new Date().toISOString() }).not("user_id", "is", null);
}
