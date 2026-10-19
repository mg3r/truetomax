import type { SupabaseClient } from "@supabase/supabase-js";
import { askJSON, buildContext } from "./ai";
import { today, weekdayOf } from "./dates";
import { seedIfNeeded } from "./seed";

const FALLBACK_AFFIRMATIONS = [
  "I finish what I start, and I let it be seen.",
  "My work is worth sharing before it feels ready.",
  "I trust the practice; today I show up for it.",
  "The people who need what I make are looking for it.",
];

const CATEGORIES = ["make", "practice", "share", "ask", "learn", "admin", "body", "rest"];

type DayPlan = {
  affirmation: string;
  question: string;
  focus: string;
  tasks: { title: string; project?: string; reason: string; category?: string; size?: string }[];
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
  let maxSuggestions = 3;
  try {
    const { data: projects } = await supabase.from("projects").select("id, title").eq("status", "active");
    const { data: todaysRhythm } = await supabase.from("tasks").select("title").eq("day", day).eq("source", "rhythm");
    const { data: ctx } = await supabase.from("profile_context").select("policy").maybeSingle();
    maxSuggestions = Math.min(3, Math.max(1, Number((ctx?.policy as { max_suggestions?: number })?.max_suggestions) || 3));
    // Recall older memories related to today's work, passage and goals.
    const query = [hl?.text, ...(todaysRhythm ?? []).map((t) => t.title), ...(projects ?? []).map((p) => p.title)].filter(Boolean).join(". ");
    const context = await buildContext(supabase, { query });
    plan = await askJSON<DayPlan>(
      `Prepare Max's day.
${hl ? `Today's saved passage (from ${hl.source}, exact text he saved): "${hl.text}"` : "He hasn't saved any passages yet; draw the question from the themes of The Creative Act without quoting it."}

Return:
{
  "affirmation": one sentence in first person, specific to where he is right now, under 20 words,
  "question": one reflective journal question rooted in ${hl ? "the passage" : "a theme of The Creative Act"} and connected to what's actually happening in his life and work right now,
  "focus": one sentence naming the single thing that would make today count,
  "tasks": up to ${maxSuggestions} suggested tasks that fit today's rhythm and move a vision forward — favor finishing, sharing, and getting paid, and follow your current guidance policy. Each: {"title": short imperative with a clear definition of done, "project": exact project title from this list or omit [${(projects ?? []).map((p) => p.title).join(", ")}], "reason": one sentence on why today, grounded in what you've learned, "category": one of make/practice/share/ask/learn/admin/body/rest ("share" = putting his work in front of people, "ask" = asking someone to book, buy, or pay), "size": small (under 30 min) / medium (1–2 hours) / large}
}
Don't repeat anything already open or skipped recently. If he has made no moves this week, at least one task should be a small share or ask.`,
      context
    );
  } catch (e) {
    console.error("prepareDay: partner unavailable", e);
  }

  const { data: projects } = await supabase.from("projects").select("id, title");
  if (plan?.tasks?.length) {
    await supabase.from("tasks").insert(
      plan.tasks.slice(0, maxSuggestions).map((t) => ({
        title: t.title,
        category: CATEGORIES.includes(t.category ?? "") ? t.category : null,
        size: ["small", "medium", "large"].includes(t.size ?? "") ? t.size : null,
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
