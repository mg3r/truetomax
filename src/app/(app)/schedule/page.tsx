import { createClient } from "@/lib/supabase/server";
import { today, weekdayOf, WEEKDAYS, addDays } from "@/lib/dates";
import { addRhythm, updateRhythm, deleteRhythm, applyRoutineToday } from "@/app/actions";
import { eventsForRange, timeLabel } from "@/lib/google";
import { Select } from "@/components/Select";
import { ActionButton, DeleteButton } from "@/components/DeleteButton";
import Link from "next/link";
import { isDue, type Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";

const PARTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "", label: "Anytime" },
];
const PART_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2 };

type Item = { id: string; weekday: number; title: string; at_time: string | null; part_of_day?: string | null; sort: number };

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Where an item sits in the day: its part of day, or the part its time falls in. */
function partOf(r: Item) {
  if (r.part_of_day) return r.part_of_day;
  if (!r.at_time) return null;
  const h = Number(r.at_time.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
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
  const everyDay = routines.filter((r) => r.cadence !== "weekly").length;
  const items = (rhythm.data ?? []) as Item[];
  const ordered = (wd: number) =>
    items
      .filter((r) => r.weekday === wd)
      .sort((a, b) => (PART_ORDER[partOf(a) ?? ""] ?? 3) - (PART_ORDER[partOf(b) ?? ""] ?? 3) || (a.at_time ?? "99").localeCompare(b.at_time ?? "99") || a.sort - b.sort);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Schedule</h1>
        <p className="mt-1 max-w-[56ch] text-muted">Your week: the rhythm you repeat, plus your calendar. Today pulls from here.</p>
        {routines.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Plus your <Link href="/routine" className="text-ink underline decoration-line underline-offset-4">routine</Link>
            {everyDay ? `: ${everyDay} thing${everyDay === 1 ? "" : "s"} every day and night` : ""}, with weekly ones shown on their days.
          </p>
        )}
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
          const list = ordered(wd);
          const cal = events?.[d] ?? [];
          const weekly = routines.filter((r) => r.cadence === "weekly" && isDue(r, d));
          const isToday = d === day;
          return (
            <div key={d} className={isToday ? "border-l border-ink pl-4" : ""}>
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

              {cal.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {cal.map((e) => (
                    <li key={e.id} className="flex items-baseline gap-3 text-sm text-muted">
                      <span className="w-24 shrink-0 tabular-nums">{e.allDay ? "all day" : timeLabel(e.start!)}</span>
                      <span className="min-w-0 flex-1">{e.title}</span>
                    </li>
                  ))}
                </ul>
              )}

              {weekly.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {weekly.map((r) => (
                    <li key={r.id} className="flex items-baseline gap-3 text-sm">
                      <span className="w-24 shrink-0 text-muted">routine</span>
                      <Link href="/routine" className="min-w-0 flex-1 hover:underline">{r.title}</Link>
                    </li>
                  ))}
                </ul>
              )}

              {list.length ? (
                <ul className="mt-2 divide-y divide-line">
                  {list.map((r) => {
                    const part = partOf(r);
                    return (
                      <li key={r.id} className="py-2.5">
                        <details>
                          <summary className="flex cursor-pointer list-none items-baseline gap-3">
                            <span className="w-24 shrink-0 text-sm text-muted tabular-nums">
                              {r.at_time ? clock(r.at_time) : part ? part : "anytime"}
                            </span>
                            <span className="min-w-0 flex-1">{r.title}</span>
                          </summary>
                          <form action={updateRhythm} className="mt-3 flex flex-wrap items-end gap-3 sm:pl-[6.75rem]">
                            <input type="hidden" name="id" value={r.id} />
                            <input name="title" defaultValue={r.title} aria-label="What" className="field min-w-[12rem] flex-1" />
                            <Select name="part_of_day" label="Part of day" className="w-32" defaultValue={r.part_of_day ?? ""} options={PARTS} />
                            <input name="at_time" type="time" defaultValue={r.at_time?.slice(0, 5) ?? ""} aria-label="Time (optional)" className="field w-32" />
                            <button className="btn-quiet">Save</button>
                            <DeleteButton action={deleteRhythm.bind(null, r.id)} label="Remove" />
                          </form>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                !cal.length && !weekly.length && <p className="mt-2 text-sm text-muted">Open day.</p>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
