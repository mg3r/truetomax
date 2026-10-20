import { createClient } from "@/lib/supabase/server";
import { today, weekdayOf, WEEKDAYS, addDays } from "@/lib/dates";
import { applyRoutineToday } from "@/app/actions";
import { ScheduleAdd } from "@/components/ScheduleAdd";
import { ScheduleItem } from "@/components/ScheduleItem";
import { eventsForRange, timeLabel } from "@/lib/google";
import { ActionButton } from "@/components/DeleteButton";
import Link from "next/link";
import { isDue, type Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";


type Item = { id: string; weekday: number; title: string; at_time: string | null; part_of_day?: string | null; sort: number; project_id?: string | null };

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

function RoutineLine({ title }: { title: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-24 shrink-0 text-sm text-muted">routine</span>
      <Link href="/routine" className="min-w-0 flex-1 hover:underline">{title}</Link>
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
      .select("id, title, day, status, at_time, part_of_day, project_id, source")
      .gte("day", week[0])
      .lte("day", week[6])
      .in("status", ["todo", "done"])
      .neq("source", "rhythm")
      .order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active").order("created_at"),
  ]);
  const projects = projectRows.data ?? [];
  const projName = new Map(projects.map((p) => [p.id, p.title]));
  const tasks = taskRows.data ?? [];
  const routines = (routineRows.data ?? []) as Routine[];
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
      />

      <section aria-label="Your week" className="space-y-9">
        {week.map((d) => {
          const wd = weekdayOf(d);
          const isToday = d === day;
          const list = items.filter((r) => r.weekday === wd);
          const weekly = routines.filter((r) => r.cadence === "weekly" && isDue(r, d));
          // One list for the day: anytime first, then morning, afternoon, evening. Within each, untimed first, then by time.
          const entries = [
            ...(events?.[d] ?? []).map((e) => {
              const at = e.allDay ? null : hhmm(e.start!);
              return { key: `e-${e.id}`, bucket: at ? BUCKET[partForTime(at)] : 0, at, sort: 0, node: <EventLine key={`e-${e.id}`} label={e.allDay ? "all day" : timeLabel(e.start!)} title={e.title} link={e.link} /> };
            }),
            ...weekly.map((r) => ({ key: `w-${r.id}`, bucket: 0, at: null, sort: r.sort, node: <RoutineLine key={`w-${r.id}`} title={r.title} /> })),
            ...list.map((r) => {
              const part = partOf(r);
              return {
                key: r.id,
                bucket: part ? BUCKET[part] : 0,
                at: r.at_time?.slice(0, 5) ?? null,
                sort: r.sort,
                node: <ScheduleItem key={r.id} item={{ ...r, part_of_day: r.part_of_day ?? null }} project={r.project_id ? projName.get(r.project_id) : null} />,
              };
            }),
            ...tasks
              .filter((t) => t.day === d)
              .map((t) => {
                const part = partOf({ ...t, weekday: 0, sort: 0 } as Item);
                return {
                  key: `t-${t.id}`,
                  bucket: part ? BUCKET[part] : 0,
                  at: t.at_time?.slice(0, 5) ?? null,
                  sort: 50,
                  node: (
                    <ScheduleItem
                      key={`t-${t.id}`}
                      kind="task"
                      item={{ id: t.id, title: t.title, at_time: t.at_time, part_of_day: t.part_of_day ?? null }}
                      project={t.project_id ? projName.get(t.project_id) : null}
                      done={t.status === "done"}
                    />
                  ),
                };
              }),
          ].sort((x, y) => x.bucket - y.bucket || (x.at ?? "").localeCompare(y.at ?? "") || x.sort - y.sort);

          return (
            <div key={d}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl">
                  {WEEKDAYS[wd]}
                  {isToday && <span className="ml-2 font-sans text-xs text-muted">today</span>}
                </h2>
                {isToday && list.length > 0 && (
                  <ActionButton action={applyRoutineToday} className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">
                    Add changes to today
                  </ActionButton>
                )}
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
