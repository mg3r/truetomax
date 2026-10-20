import { createClient } from "@/lib/supabase/server";
import { inActiveWork } from "@/lib/links";
import { today, weekdayOf, WEEKDAYS, addDays } from "@/lib/dates";
import { ScheduleAdd } from "@/components/ScheduleAdd";
import { ScheduleItem } from "@/components/ScheduleItem";
import { sameThing } from "@/lib/match";
import { eventsForRange, timeLabel } from "@/lib/google";
import Link from "next/link";
import { isDue, isPinned, isPractice, timesOf, loadPractices, type Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";


type Item = { id: string; weekday: number; title: string; at_time: string | null; part_of_day?: string | null; sort: number; project_id?: string | null; routine_id?: string | null };

/** Where an item sits in the day: its part of day, or the part its time falls in. */
function partOf(r: Item) {
  if (r.part_of_day) return r.part_of_day;
  if (!r.at_time) return null;
  const h = Number(r.at_time.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const BUCKET: Record<string, number> = { morning: 1, afternoon: 2, evening: 3 };
const partForTime = (t: string) => {
  const h = Number(t.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};
const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "America/New_York" }).format(new Date(iso));

/** A Google Calendar event: shown in place, not editable here. */
function EventLine({ label, title, link }: { label: string; title: string; link?: string }) {
  return (
    <li className="flex items-center gap-3 py-2 text-muted">
      <span className="w-24 shrink-0 text-sm tabular-nums">{label}</span>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:text-ink hover:underline">{title}</a>
      ) : (
        <span className="min-w-0 flex-1">{title}</span>
      )}
      <span className="shrink-0 text-xs">calendar</span>
    </li>
  );
}

/** Daily or nightly routine for one day: done so far on past days and today, just the count ahead. */
function RoutineSummary({ label, done, total, ahead }: { label: string; done: number; total: number; ahead: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-24 shrink-0 text-sm text-muted">{label.startsWith("Nightly") ? "evening" : "anytime"}</span>
      <Link href="/rhythm" className="min-w-0 flex-1 hover:underline">{label}</Link>
      <span className="shrink-0 text-xs text-muted tabular-nums">{ahead ? total : `${done} of ${total}`}</span>
    </li>
  );
}

function PracticedLine({ name }: { name: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-24 shrink-0 text-sm text-muted">practiced</span>
      <Link href="/rhythm" className="min-w-0 flex-1 hover:underline">{name}</Link>
      <span className="shrink-0 text-xs text-muted">done</span>
    </li>
  );
}


export default async function SchedulePage() {
  const supabase = await createClient();
  const day = today();
  const todayWd = weekdayOf(day);
  const monday = addDays(day, -((todayWd + 6) % 7));
  // This week, Monday first, as real dates so calendar events land on the right day.
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const [rhythm, events, routineRows, taskRows, projectRows] = await Promise.all([
    supabase.from("rhythm").select("*").order("sort").order("created_at"),
    eventsForRange(supabase, monday, 7),
    supabase.from("routines").select("*").order("sort"),
    // One-time tasks dated this week: the same ones Today and your projects show. Schedule's own weekly items are shown as themselves.
    supabase
      .from("tasks")
      .select("*")
      .gte("day", week[0])
      .lte("day", week[6])
      .in("status", ["todo", "done"])
      .neq("source", "rhythm")
      .order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active").order("created_at"),
  ]);
  // Practices from your Rhythm: to schedule a session, and to show the days you practiced.
  const practices = await loadPractices(supabase);
  const practiceName = new Map(practices.map((p) => [p.id, p.name]));
  const { data: checkRows } = await supabase.from("routine_checks").select("routine_id, day").gte("day", week[0]).lte("day", week[6]);
  const checked = new Set((checkRows ?? []).map((c) => `${c.routine_id}:${c.day}`));
  const projects = projectRows.data ?? [];
  // Only actions from projects you've accepted (In progress) appear on your Schedule.
  const activeIds = new Set(projects.map((p) => p.id));
  const tasks = (taskRows.data ?? []).filter((t) => inActiveWork(t, activeIds));
  const routines = (routineRows.data ?? []) as Routine[];
  const dailyItems = routines.filter((r) => r.cadence === "daily");
  const nightlyItems = routines.filter((r) => r.cadence === "nightly");
  // Weekly items on any day aren't tied to a date: one line for the week, with how many you've done.
  const anyDay = routines.filter((r) => r.cadence === "weekly" && !isPinned(r));
  // Rituals and practices get their own lines: "Daily rituals", "Weekly practices"…
  const KIND = [
    { practice: false, word: "rituals" },
    { practice: true, word: "practices" },
  ];
  const weeklyGroups = KIND.map((k) => {
    const list = anyDay.filter((r) => isPractice(r) === k.practice);
    return {
      ...k,
      list,
      done: list.reduce((n, r) => n + Math.min(timesOf(r), (checkRows ?? []).filter((c) => c.routine_id === r.id).length), 0),
      total: list.reduce((n, r) => n + timesOf(r), 0),
    };
  }).filter((g) => g.list.length);
  const items = (rhythm.data ?? []) as Item[];

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Schedule</h1>
      </div>

      <ScheduleAdd
        week={week.map((d) => ({ date: d, weekday: weekdayOf(d), short: WEEKDAYS[weekdayOf(d)].slice(0, 3), num: Number(d.slice(8)) }))}
        today={day}
        projects={projects}
        practices={practices}
      />

      {weeklyGroups.length > 0 && (
        <div className="divide-y divide-line border-y border-line">
          {weeklyGroups.map((g) => (
            <Link key={g.word} href="/rhythm" className="flex items-baseline justify-between gap-3 py-3 hover:text-ink">
              <span>
                Weekly {g.word} <span className="text-sm text-muted">· any day: {g.list.map((r) => `${r.title} ${timesOf(r)}×`).join(", ")}</span>
              </span>
              <span className="shrink-0 text-sm text-muted tabular-nums">{g.done} of {g.total} this week</span>
            </Link>
          ))}
        </div>
      )}

      <section aria-label="Your week" className="space-y-9">
        {week.map((d) => {
          const wd = weekdayOf(d);
          const isToday = d === day;
          const list = items.filter((r) => r.weekday === wd);
          const weekly = routines.filter((r) => isPinned(r) && isDue(r, d));
          // One list for the day: anytime first, then morning, afternoon, evening. Within each, untimed first, then by time.
          const dayTasks = tasks.filter((t) => t.day === d);
          // A calendar event with the same name as something here shows once: the app's item, at the event's time, linked to the calendar.
          const dayEvents = events?.[d] ?? [];
          const used = new Set<string>();
          const eventFor = (title: string) => {
            const e = dayEvents.find((ev) => !used.has(ev.id) && sameThing(ev.title, title));
            if (e) used.add(e.id);
            return e ? { link: e.link, at: e.allDay ? null : hhmm(e.start!), label: e.allDay ? "all day" : timeLabel(e.start!) } : null;
          };
          const weeklyMatched = weekly.map((r) => ({ r, cal: eventFor(r.title) }));
          const listMatched = list.map((r) => ({ r, cal: eventFor(r.title) }));
          const tasksMatched = dayTasks.map((t) => ({ t, cal: eventFor(t.title) }));
          // Practices you logged that day, unless a scheduled item for that practice already shows it.
          // Weekly practices aren't tied to a day, so the days you did them show here (unless a scheduled item already does).
          const covered = new Set([...list, ...dayTasks].map((x) => (x as { routine_id?: string | null }).routine_id).filter(Boolean));
          const weeklyPractice = new Set(routines.filter((r) => isPractice(r) && r.cadence === "weekly" && !isPinned(r)).map((r) => r.id));
          const practicedLines = (checkRows ?? [])
            .filter((x) => x.day === d && weeklyPractice.has(x.routine_id) && !covered.has(x.routine_id))
            .map((x) => ({ key: `p-${x.routine_id}`, bucket: 0, at: null, sort: -0.5, node: <PracticedLine key={`p-${x.routine_id}`} name={practiceName.get(x.routine_id) ?? ""} /> }));
          const entries = [
            ...practicedLines,
            ...dayEvents.filter((e) => !used.has(e.id)).map((e) => {
              const at = e.allDay ? null : hhmm(e.start!);
              return { key: `e-${e.id}`, bucket: at ? BUCKET[partForTime(at)] : 0, at, sort: 0, node: <EventLine key={`e-${e.id}`} label={e.allDay ? "all day" : timeLabel(e.start!)} title={e.title} link={e.link} /> };
            }),
            ...[
              { items: dailyItems, when: "Daily", bucket: 0, at: null as string | null, sort: -1 },
              { items: nightlyItems, when: "Nightly", bucket: 3, at: "99:99", sort: 0 },
            ].flatMap((w) =>
              KIND.map((k) => ({ k, list: w.items.filter((r) => isPractice(r) === k.practice) }))
                .filter(({ list }) => list.length)
                .map(({ k, list }) => ({
                  key: `r-${w.when}-${k.word}`,
                  bucket: w.bucket,
                  at: w.at,
                  sort: w.sort + (k.practice ? 0.1 : 0),
                  node: (
                    <RoutineSummary
                      key={`r-${w.when}-${k.word}`}
                      label={`${w.when} ${k.word}`}
                      total={list.length}
                      done={list.filter((r) => checked.has(`${r.id}:${d}`)).length}
                      ahead={d > day}
                    />
                  ),
                }))
            ),
            ...weeklyMatched.map(({ r, cal }) => {
              const w = r as Routine & { at_time?: string | null; part_of_day?: string | null };
              const own = w.at_time?.slice(0, 5) ?? null;
              const at = own ?? cal?.at ?? null;
              const part = own ? partForTime(own) : w.part_of_day ?? (cal?.at ? partForTime(cal.at) : null);
              return {
                key: `w-${r.id}`,
                bucket: part ? BUCKET[part] : 0,
                at,
                sort: r.sort,
                node: (
                  <ScheduleItem
                    key={`w-${r.id}`}
                    kind="routine"
                    item={{ id: r.id, title: r.title, at_time: w.at_time ?? null, part_of_day: w.part_of_day ?? null }}
                    calendar={cal}
                  />
                ),
              };
            }),
            ...listMatched.map(({ r, cal }) => {
              const own = r.at_time?.slice(0, 5) ?? null;
              const at = own ?? cal?.at ?? null;
              const part = own ? partOf(r) : cal?.at ? partForTime(cal.at) : partOf(r);
              return {
                key: r.id,
                bucket: part ? BUCKET[part] : 0,
                at,
                sort: r.sort,
                node: <ScheduleItem key={r.id} item={{ ...r, part_of_day: r.part_of_day ?? null }} calendar={cal} />,
              };
            }),
            ...tasksMatched.map(({ t, cal }) => {
              const own = t.at_time?.slice(0, 5) ?? null;
              const at = own ?? cal?.at ?? null;
              const part = own ? partOf({ ...t, weekday: 0, sort: 0 } as Item) : cal?.at ? partForTime(cal.at) : partOf({ ...t, weekday: 0, sort: 0 } as Item);
              return {
                key: `t-${t.id}`,
                bucket: part ? BUCKET[part] : 0,
                at,
                sort: 50,
                node: (
                  <ScheduleItem
                    key={`t-${t.id}`}
                    kind="task"
                    item={{ id: t.id, title: t.title, at_time: t.at_time, part_of_day: t.part_of_day ?? null }}
                    done={t.status === "done"}
                    calendar={cal}
                    action={{ id: t.id, day: t.day, status: t.status, part_of_day: t.part_of_day ?? null, at_time: t.at_time ?? null, project_id: t.project_id ?? null, routine_id: t.routine_id ?? null, project_ids: t.project_ids ?? null, routine_ids: t.routine_ids ?? null, reason: t.reason ?? null }}
                    today={day}
                    projects={projects}
                    practices={practices}
                  />
                ),
              };
            }),
          ].sort((x, y) => x.bucket - y.bucket || (x.at ?? "").localeCompare(y.at ?? "") || x.sort - y.sort);

          return (
            // Today stands out as its own card, so you find it at a glance.
            <div key={d} id={isToday ? "today" : undefined} aria-current={isToday ? "date" : undefined} className={isToday ? "pebble -mx-4 bg-surface px-4 py-4 shadow-[0_0_0_1px_var(--ink)] sm:-mx-5 sm:px-5" : ""}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl">
                  {WEEKDAYS[wd]}
                  {isToday && <span className="ml-2 rounded-full bg-ink px-2.5 py-0.5 align-middle font-sans text-xs text-bg">Today</span>}
                </h2>
              </div>
              {entries.length ? (
                <ul className="mt-2 divide-y divide-line">{entries.map((e) => e.node)}</ul>
              ) : (
                <p className="mt-2 text-sm text-muted">Open day.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
