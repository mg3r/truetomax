import type { SupabaseClient } from "@supabase/supabase-js";
import { askJSON, buildContext } from "./ai";
import { today, weekdayOf } from "./dates";
import { seedIfNeeded } from "./seed";
import { eventsForDay, timeLabel } from "./google";

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
    const full = await supabase.from("rhythm").select("title, project_id, at_time, part_of_day").eq("weekday", weekdayOf(day)).order("sort");
    if (!full.error && full.data?.length) {
      await supabase.from("tasks").insert(full.data.map((r) => ({ ...r, day, source: "rhythm" })));
    } else if (full.error) {
      // Before the setup files run, rhythm may not have time or part-of-day columns yet.
      const { data: rhythm } = await supabase.from("rhythm").select("title, project_id").eq("weekday", weekdayOf(day)).order("sort");
      if (rhythm?.length) await supabase.from("tasks").insert(rhythm.map((r) => ({ title: r.title, project_id: r.project_id, day, source: "rhythm" })));
    }
  }

  // 2. Today's reading: a page from your copy of the book if you've added it, otherwise a saved passage.
  const page = await pickPage(supabase, day);
  const hl = page
    ? null
    : (
        await supabase
          .from("highlights")
          .select("id, text, source, times_shown")
          .order("times_shown", { ascending: true })
          .order("last_shown", { ascending: true, nullsFirst: true })
          .limit(1)
          .maybeSingle()
      ).data;
  if (hl) await supabase.from("highlights").update({ times_shown: hl.times_shown + 1, last_shown: day }).eq("id", hl.id);
  const reading = readingPrompt(page, hl);

  // 3. The partner's read on today.
  let plan: DayPlan | null = null;
  let maxSuggestions = 3;
  try {
    const { data: projects } = await supabase.from("projects").select("id, title").eq("status", "active");
    const { data: todaysRhythm } = await supabase.from("tasks").select("title").eq("day", day).eq("source", "rhythm");
    const { data: ctx } = await supabase.from("profile_context").select("policy").maybeSingle();
    maxSuggestions = Math.min(3, Math.max(1, Number((ctx?.policy as { max_suggestions?: number })?.max_suggestions) || 3));
    // Recall older memories related to today's work, passage and goals.
    const query = [page?.text.slice(0, 600) ?? hl?.text, ...(todaysRhythm ?? []).map((t) => t.title), ...(projects ?? []).map((p) => p.title)].filter(Boolean).join(". ");
    const events = await eventsForDay(supabase, day).catch(() => null);
    const calendar = events?.length
      ? `\n\n## Today's calendar\n${events.map((e) => `- ${e.allDay ? "all day" : `${timeLabel(e.start!)}–${e.end ? timeLabel(e.end) : ""}`}: ${e.title}`).join("\n")}\nPlan suggestions around these; don't stack work on top of them.`
      : "";
    const context = (await buildContext(supabase, { query })) + calendar;
    plan = await askJSON<DayPlan>(
      `Prepare Max's day.
${reading}

Return:
{
  "affirmation": one sentence in first person, under 20 words, drawn from the idea in today's reading and made specific to where he is right now — in your own words, not a quote,
  "question": one reflective journal question rooted in today's reading and connected to what's actually happening in his life and work right now,
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
      ...(page ? { page_id: page.id } : {}),
      affirmation: plan?.affirmation ?? FALLBACK_AFFIRMATIONS[new Date().getDate() % FALLBACK_AFFIRMATIONS.length],
      question: plan?.question ?? "What would you make today if no one ever saw it — and what would you make if everyone did?",
      focus: plan?.focus ?? null,
    })
    .eq("day", day);
}

type Page = { id: string; page: number; book: string; text: string };

/** A page you haven't seen in a while, chosen at random among the least-shown. Null until you add a book. */
async function pickPage(supabase: SupabaseClient, day: string): Promise<Page | null> {
  const { data: least, error } = await supabase.from("book_pages").select("times_shown").order("times_shown").limit(1).maybeSingle();
  if (error || !least) return null; // no book yet (or the book table isn't set up)
  const { data: pool } = await supabase.from("book_pages").select("id, page, book, text").eq("times_shown", least.times_shown).limit(1000);
  // Skip near-empty pages (title pages, blanks) when there's anything better.
  const candidates = (pool ?? []).filter((p) => p.text.trim().length >= 250);
  const choices = candidates.length ? candidates : pool ?? [];
  if (!choices.length) return null;
  const page = choices[Math.floor(Math.random() * choices.length)];
  await supabase.from("book_pages").update({ times_shown: least.times_shown + 1, last_shown: day }).eq("id", page.id);
  return page;
}

function readingPrompt(page: Page | null, hl: { text: string; source: string } | null) {
  if (page) {
    return `Today's reading is page ${page.page} of ${page.book}, from Max's own copy:\n"""\n${page.text.slice(0, 4000)}\n"""\nBase today's question and affirmation on this page's idea. Put it in your own words; don't quote more than a few words of it.`;
  }
  if (hl) return `Today's saved passage (from ${hl.source}, exact text he saved): "${hl.text}"`;
  return "He hasn't added the book or saved any passages yet; draw the question from the themes of The Creative Act without quoting it.";
}

/** Swap today's question for a different one from the same reading. Your journal draft is untouched. */
export async function newQuestion(supabase: SupabaseClient) {
  const day = today();
  const { data: d } = await supabase.from("days").select("*").eq("day", day).maybeSingle();
  if (!d) throw new Error("Today isn't prepared yet.");
  const [page, hl] = await Promise.all([
    d.page_id ? supabase.from("book_pages").select("id, page, book, text").eq("id", d.page_id).maybeSingle() : Promise.resolve({ data: null }),
    d.highlight_id ? supabase.from("highlights").select("text, source").eq("id", d.highlight_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const asked: string[] = [...(d.past_questions ?? []), d.question].filter(Boolean);
  const context = await buildContext(supabase, { skipLearned: true, journalCount: 5 });
  const { question } = await askJSON<{ question: string }>(
    `${readingPrompt(page.data as Page | null, hl.data)}

Ask Max a different reflective journal question from today's reading — a new angle, not a rewording. Already asked today:
${asked.map((q) => `- ${q}`).join("\n")}

Return {"question": "..."}`,
    context,
    400
  );
  if (!question?.trim()) throw new Error("No question came back.");
  await supabase.from("days").update({ question: question.trim(), past_questions: asked }).eq("day", day);
}
