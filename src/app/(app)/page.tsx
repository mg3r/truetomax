import Link from "next/link";
import { inActiveWork, namesOf, projectsOf, practicesOf } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { today, prettyDay, addDays, weekdayOf } from "@/lib/dates";
import { MovesLine, type Move } from "@/components/Moves";
import { SaveLine } from "@/components/SaveLine";
import { AskPartner } from "@/components/AskPartner";
import { Mark } from "@/components/Mark";
import { PrepareDay } from "@/components/PrepareDay";
import { TaskRow, SuggestionRow, EventRow, type Task } from "@/components/Tasks";
import { eventsForDay, googleConfigured, timeLabel } from "@/lib/google";
import { JournalForm } from "@/components/JournalForm";
import { RoutineToday } from "@/components/Routine";
import { isDue, isPinned, timesOf, mondayOf, loadPractices, type Routine } from "@/lib/routine";
import { sameThing } from "@/lib/match";
import { sectionAround, type Passage } from "@/lib/passage";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const day = today();

  const { data: d } = await supabase.from("days").select("*").eq("day", day).maybeSingle();
  if (!d?.affirmation) return <PrepareDay />;

  const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7)); // Monday
  const [page, highlight, tasks, projects, entry, moves, unseen, proposals, hunches] = await Promise.all([
    d.page_id ? supabase.from("book_pages").select("page, book, text").eq("id", d.page_id).maybeSingle() : Promise.resolve({ data: null }),
    d.highlight_id ? supabase.from("highlights").select("text, source, location").eq("id", d.highlight_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("tasks")
      .select("*")
      // Unfinished one-time tasks carry over; things that repeat come back on their own day instead.
      .or(`and(day.lt.${day},status.eq.todo,source.neq.rhythm),and(day.eq.${day},status.in.(todo,done,suggested))`)
      .order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active").order("created_at"),
    supabase.from("journal_entries").select("id, body").eq("day", day).eq("prompt", d.question ?? "").maybeSingle(),
    supabase.from("moves").select("*").gte("day", weekStart).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("seen", false),
    supabase.from("rhythm_proposals").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("insights").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);
  // Routine: what's due today and what's already ticked. Quietly absent until its migration runs.
  const [routineRows, routineChecks] = await Promise.all([
    supabase.from("routines").select("*").order("sort").order("created_at"),
    supabase.from("routine_checks").select("routine_id, day").gte("day", mondayOf(day)).lte("day", day),
  ]);
  const checkRows = routineChecks.data ?? [];
  const checked = checkRows.filter((c) => c.day === day).map((c) => c.routine_id as string);
  // Weekly items on any day: how many times so far this week, not counting today.
  const weekDone: Record<string, number> = {};
  for (const c of checkRows) if (c.day !== day) weekDone[c.routine_id] = (weekDone[c.routine_id] ?? 0) + 1;
  // Once a weekly item has been done enough times this week, it steps aside until Monday.
  const routine = ((routineRows.data ?? []) as Routine[]).filter(
    (r) => isDue(r, day) && (r.cadence !== "weekly" || isPinned(r) || checked.includes(r.id) || (weekDone[r.id] ?? 0) < timesOf(r))
  );
  const routineDone = routine.filter((r) => checked.includes(r.id)).length;

  // Today's reading: the whole section the chosen page belongs to, from its heading to where it ends.
  let passage: Passage | null = null;
  if (page.data) {
    const { data: around } = await supabase
      .from("book_pages")
      .select("page, text")
      .eq("book", page.data.book)
      .gte("page", page.data.page - 9)
      .lte("page", page.data.page + 9);
    passage = sectionAround({ page: page.data.page, text: page.data.text }, around ?? []);
  }

  const mv = moves.data ?? [];
  const learnedNotes = [
    unseen.count ? "a new weekly review" : null,
    hunches.count ? `${hunches.count} thing${hunches.count === 1 ? "" : "s"} it thinks it's learned` : null,
    proposals.count ? `${proposals.count} rhythm change${proposals.count === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const projName = new Map((projects.data ?? []).map((p) => [p.id, p.title]));
  const practiceList = await loadPractices(supabase);
  const practiceNames = new Map(practiceList.map((p) => [p.id, p.name]));
  // Actions from projects that aren't In progress (in review, backlog, done) stay inside their project.
  const activeIds = new Set((projects.data ?? []).map((p) => p.id));
  const all: Task[] = (tasks.data ?? []).filter((t) => inActiveWork(t, activeIds)).map((t) => ({ ...t, project: namesOf(projectsOf(t), projName), practice: namesOf(practicesOf(t), practiceNames) }));
  const suggestions = all.filter((t) => t.status === "suggested");
  // Rhythm first, then everything else; finished tasks sink to the bottom.
  const list = all
    .filter((t) => t.status !== "suggested")
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || Number(b.source === "rhythm") - Number(a.source === "rhythm"));
  const doneCount = list.filter((t) => t.status === "done").length;

  // Calendar events and timed routine items form the day's schedule; everything else follows.
  const [events, google] = await Promise.all([
    eventsForDay(supabase, day),
    googleConfigured() ? supabase.from("google_accounts").select("email").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const hhmm = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "America/New_York" }).format(new Date(iso));
  // A calendar event with the same name as a task or routine item shows once: the item you tick, at the event's time.
  const routineTime = new Map<string, string>();
  const taskTime = new Map<string, string>();
  const shownEvents = (events ?? []).filter((e) => {
    const t = list.find((x) => !taskTime.has(x.id) && sameThing(x.title, e.title));
    if (t) {
      if (!e.allDay && !t.at_time) taskTime.set(t.id, hhmm(e.start!));
      else taskTime.set(t.id, "");
      return false;
    }
    const r = routine.find((x) => !routineTime.has(x.id) && sameThing(x.title, e.title));
    if (r) {
      routineTime.set(r.id, e.allDay ? "" : timeLabel(e.start!));
      return false;
    }
    return true;
  });
  const timed = list.map((t) => (taskTime.get(t.id) ? { ...t, at_time: taskTime.get(t.id)! } : t));
  // Calendar events get their own list; your actions follow, timed ones in time order, then the rest by part of day.
  const allDay = shownEvents.filter((e) => e.allDay);
  const timedEvents = shownEvents.filter((e) => !e.allDay).sort((x, y) => hhmm(x.start!).localeCompare(hhmm(y.start!)));
  const PART: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };
  const actions = [...timed].sort(
    (x, y) =>
      Number(x.status === "done") - Number(y.status === "done") ||
      Number(!x.at_time) - Number(!y.at_time) ||
      (x.at_time ?? "").localeCompare(y.at_time ?? "") ||
      (PART[x.part_of_day ?? ""] ?? 3) - (PART[y.part_of_day ?? ""] ?? 3)
  );

  // Where the focus line leads: the suggestion on this page, or the action on Actions.
  const focusTask = d.focus_task_id ? all.find((t) => t.id === d.focus_task_id) : null;
  const focusHref = !focusTask ? null : focusTask.status === "suggested" ? `#s-${focusTask.id}` : focusTask.source === "rhythm" ? null : `/actions?open=${focusTask.id}`;

  return (
    <div className="space-y-16">
      {/* The morning's words, with one slow-moving form behind them. */}
      <section aria-label="Affirmation" className="relative isolate pt-10 pb-4">
        <div className="morning-form" aria-hidden="true" />
        <Mark size={30} className="mark-draw text-ink" />
        <p className="mt-6 text-sm text-muted">
          {prettyDay(day)}
          <PrepareDay auto={false} />
        </p>
        <h1 className="mt-2 max-w-[20ch] font-serif text-[2.15rem] leading-[1.12] font-normal tracking-[-0.02em] sm:text-[3rem]">{d.affirmation}</h1>
        {d.focus &&
          (focusHref ? (
            // A way in, not a test: tap it to go to the action it's about. Nothing changes whether or not you do it.
            <Link href={focusHref} className="mt-6 block max-w-[52ch] text-muted hover:text-ink hover:underline hover:decoration-line hover:underline-offset-4">
              {d.focus}
            </Link>
          ) : (
            <p className="mt-6 max-w-[52ch] text-muted">{d.focus}</p>
          ))}
      </section>

      {learnedNotes.length > 0 && (
        <Link href="/partner?view=learned" className="block pebble border border-line px-4 py-3 hover:bg-surface">
          <span className="font-semibold">Your partner has {learnedNotes.join(", ")}.</span>{" "}
          <span className="text-muted">Check it&rsquo;s right so it keeps learning the right things.</span>
        </Link>
      )}

      <section aria-labelledby="passage">
        {page.data ? (
          <>
            <h2 id="passage" className="section-title">today&rsquo;s reading</h2>
            <article className="mt-3 max-w-[62ch]">
              <div className="space-y-4 font-serif text-[1.15rem] leading-[1.75]">
                {passage?.title && <h3 className="font-serif text-2xl leading-snug">{passage.title}</h3>}
                {(passage?.text ?? page.data.text)
                  .split(/\n{2,}/)
                  .map((para: string) => para.replace(/\s*\n\s*/g, " ").trim())
                  .filter(Boolean)
                  .map((para: string, i: number) => <p key={i}>{para}</p>)}
              </div>
              <p className="mt-3 text-sm text-muted">
                {page.data.book}, {passage && passage.to > passage.from ? `pages ${passage.from}\u2013${passage.to}` : `page ${page.data.page}`}
              </p>
            </article>
            <SaveLine book={page.data.book} page={page.data.page} />
          </>
        ) : (
          <>
            <h2 id="passage" className="section-title">today&rsquo;s passage</h2>
            {highlight.data ? (
              <figure className="mt-3">
                <blockquote className="max-w-[58ch] font-serif text-xl leading-relaxed italic">{highlight.data.text}</blockquote>
                <figcaption className="mt-2 text-sm text-muted">
                  {highlight.data.source}
                  {highlight.data.location ? `, ${highlight.data.location}` : ""}
                </figcaption>
              </figure>
            ) : (
              <p className="mt-2 text-muted">
                Add your copy of The Creative Act and a page will open here each morning.{" "}
                <Link href="/profile?tab=context#book" className="text-ink underline decoration-line underline-offset-4">Add the book</Link>
              </p>
            )}
          </>
        )}
      </section>

      {(allDay.length > 0 || timedEvents.length > 0) && (
        <section aria-labelledby="calendar">
          <h2 id="calendar" className="section-title">Calendar</h2>
          <ul className="mt-2 divide-y divide-line">
            {allDay.map((e) => <EventRow key={e.id} time="all day" title={e.title} calendar={e.calendar} location={e.location} link={e.link} />)}
            {timedEvents.map((e) => <EventRow key={e.id} time={timeLabel(e.start!)} title={e.title} calendar={e.calendar} location={e.location} link={e.link} />)}
          </ul>
        </section>
      )}

      <section aria-labelledby="tasks">
        <div className="flex items-baseline justify-between">
          <h2 id="tasks" className="section-title">
            <Link href="/actions" className="hover:text-ink">Actions</Link>
          </h2>
          {list.length > 0 && <span className="text-sm text-muted">{doneCount} of {list.length} done</span>}
        </div>
        {actions.length > 0 ? (
          <ul className="mt-2 divide-y divide-line">
            {actions.map((t) => <TaskRow key={t.id} task={t} today={day} showTime={actions.some((x) => x.at_time)} />)}
          </ul>
        ) : (
          <p className="mt-2 text-muted">
            Nothing set for today yet. <Link href="/actions" className="text-ink underline decoration-line underline-offset-4">Add actions</Link>, or pick from your partner&rsquo;s suggestions.
          </p>
        )}
        {googleConfigured() && !google.data && (
          <p className="mt-3 text-sm text-muted">
            <Link href="/profile?tab=settings" className="underline decoration-line underline-offset-4 hover:text-ink">Connect Google Calendar</Link> to see today&rsquo;s events here.
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="mt-8 pebble bg-surface p-4 sm:p-5">
            <h3 className="section-title">your partner suggests</h3>
            <ul className="divide-y divide-line">
              {suggestions.map((t) => <SuggestionRow key={t.id} task={t} today={day} projects={projects.data ?? []} practices={practiceList} />)}
            </ul>
          </div>
        )}
      </section>

      {routine.length > 0 && (
        <section aria-labelledby="routine">
          <div className="flex items-baseline justify-between">
            <h2 id="routine" className="section-title">
              <Link href="/rhythm" className="hover:text-ink">Rhythm</Link>
            </h2>
            <span className="text-sm text-muted">{routineDone} of {routine.length}</span>
          </div>
          <div className="mt-2">
            <RoutineToday items={routine} checked={checked} day={day} times={Object.fromEntries(routineTime)} weekDone={weekDone} />
          </div>
        </section>
      )}


      <section aria-label="Moves this week">
        <MovesLine key={mv.map((m) => m.id).join(",")} moves={mv as Move[]} />
      </section>

      <section aria-labelledby="question">
        <h2 id="question" className="section-title">Today&rsquo;s question</h2>
        <p className="mt-2 max-w-[60ch] font-serif text-xl leading-relaxed">{d.question}</p>
        <div className="mt-3 mb-5">
          <AskPartner endpoint="/api/question" label="Ask me something else" busyLabel="Finding another angle…" className="btn-quiet" />
        </div>
        <JournalForm key={entry.data?.id ?? "new"} id={entry.data?.id} prompt={d.question} day={day} initial={entry.data?.body ?? ""} />
      </section>

    </div>
  );
}
