import { createClient } from "@/lib/supabase/server";
import { today, weekdayOf, WEEKDAYS, addDays } from "@/lib/dates";
import { addRhythm, applyRoutineToday } from "@/app/actions";
import { ScheduleItem } from "@/components/ScheduleItem";
import { eventsForRange, timeLabel } from "@/lib/google";
import { ActionButton } from "@/components/DeleteButton";
import Link from "next/link";
import { isDue, type Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";

const PARTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "", label: "Anytime" },
];

type Item = { id: string; weekday: number; title: string; at_time: string | null; part_of_day?: string | null; sort: number };

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
function EventLine({ label, title }: { label: string; title: string }) {
  return (
    <li className="flex items-center gap-3 py-2 text-muted">
      <span className="w-24 shrink-0 text-sm tabular-nums">{label}</span>
      <span className="min-w-0 flex-1">{title}</span>
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

  const [rhythm, events, routineRows] = await Promise.all([
    supabase.from("rhythm").select("*").order("sort").order("created_at"),
    eventsForRange(supabase, monday, 7),
    supabase.from("routines").select("*").order("sort"),
  ]);
  const routines = (routineRows.data ?? []) as Routine[];
  const items = (rhythm.data ?? []) as Item[];

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Schedule</h1>
      </div>

      <section aria-labelledby="add" className="pebble bg-surface p-5">
        <h2 id="add" className="section-title">add to your week</h2>
        <form action={addRhythm} className="mt-4 space-y-4">
          <input name="title" required placeholder="e.g. Pottery at the studio" aria-label="What" className="field" />
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Part of day</legend>
            {PARTS.map((p) => (
              <label key={p.label} className="cursor-pointer">
                <input type="radio" name="part_of_day" value={p.value} defaultChecked={p.value === "morning"} className="peer sr-only" />
                <span className="btn-quiet peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">
                  {p.label}
                </span>
              </label>
            ))}
            <input name="at_time" type="time" aria-label="Time (optional)" className="field ml-1 w-32" />
          </fieldset>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Days</legend>
            {week.map((d) => {
              const wd = weekdayOf(d);
              return (
                <label key={wd} className="cursor-pointer">
                  <input type="checkbox" name="weekday" value={wd} defaultChecked={wd === todayWd} className="peer sr-only" />
                  <span className="btn-quiet peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">
                    {WEEKDAYS[wd].slice(0, 3)}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button className="btn">Add</button>
        </form>
      </section>

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
              return { key: `e-${e.id}`, bucket: at ? BUCKET[partForTime(at)] : 0, at, sort: 0, node: <EventLine key={`e-${e.id}`} label={e.allDay ? "all day" : timeLabel(e.start!)} title={e.title} /> };
            }),
            ...weekly.map((r) => ({ key: `w-${r.id}`, bucket: 0, at: null, sort: r.sort, node: <RoutineLine key={`w-${r.id}`} title={r.title} /> })),
            ...list.map((r) => {
              const part = partOf(r);
              return { key: r.id, bucket: part ? BUCKET[part] : 0, at: r.at_time?.slice(0, 5) ?? null, sort: r.sort, node: <ScheduleItem key={r.id} item={{ ...r, part_of_day: r.part_of_day ?? null }} /> };
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
