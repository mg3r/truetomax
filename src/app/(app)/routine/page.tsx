import { createClient } from "@/lib/supabase/server";
import { today, weekdayOf, WEEKDAYS } from "@/lib/dates";
import { addRhythm, updateRhythm, deleteRhythm, applyRoutineToday } from "@/app/actions";
import { ActionButton, DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

// Monday-first, the way the week is lived.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

type Item = { id: string; weekday: number; title: string; at_time: string | null; sort: number };

function clock(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default async function RoutinePage() {
  const supabase = await createClient();
  const todayWd = weekdayOf(today());
  const rhythm = await supabase.from("rhythm").select("*").order("sort").order("created_at");
  const items = (rhythm.data ?? []) as Item[];
  // Timed items in time order, untimed ones after.
  const ordered = (wd: number) =>
    items.filter((r) => r.weekday === wd).sort((a, b) => (a.at_time ?? "99").localeCompare(b.at_time ?? "99") || a.sort - b.sort);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Routine</h1>
        <p className="mt-1 max-w-[56ch] text-muted">
          The rhythm of your week. Each day&rsquo;s routine becomes part of Today, alongside your calendar and your project tasks.
        </p>
      </div>

      <section aria-labelledby="add" className="pebble bg-surface p-5">
        <h2 id="add" className="section-title">add to your routine</h2>
        <form action={addRhythm} className="mt-4 space-y-4">
          <input name="title" required placeholder="e.g. Morning practice and intentions" aria-label="Routine item" className="field" />
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="at_time" className="block text-xs text-muted">Time (optional)</label>
              <input id="at_time" name="at_time" type="time" className="field w-32" />
            </div>
          </div>
          <fieldset>
            <legend className="text-xs text-muted">Days</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ORDER.map((wd) => (
                <label key={wd} className="cursor-pointer">
                  <input type="checkbox" name="weekday" value={wd} defaultChecked={wd === todayWd} className="peer sr-only" />
                  <span className="btn-quiet peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">
                    {WEEKDAYS[wd].slice(0, 3)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn">Add to routine</button>
        </form>
      </section>

      <section aria-label="Your week" className="space-y-8">
        {ORDER.map((wd) => {
          const list = ordered(wd);
          return (
            <div key={wd} className={wd === todayWd ? "border-l border-ink pl-4" : ""}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-xl">
                  {WEEKDAYS[wd]}
                  {wd === todayWd && <span className="ml-2 font-sans text-xs text-muted">today</span>}
                </h2>
                {wd === todayWd && list.length > 0 && (
                  <ActionButton action={applyRoutineToday} className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">
                    Add changes to today
                  </ActionButton>
                )}
              </div>
              {list.length ? (
                <ul className="mt-2 divide-y divide-line">
                  {list.map((r) => (
                    <li key={r.id} className="py-2.5">
                      <details>
                        <summary className="flex cursor-pointer list-none items-baseline gap-3">
                          <span className="w-16 shrink-0 text-sm text-muted tabular-nums">{clock(r.at_time) ?? "anytime"}</span>
                          <span className="min-w-0 flex-1">{r.title}</span>
                        </summary>
                        <form action={updateRhythm} className="mt-3 flex flex-wrap items-end gap-3 sm:pl-[4.75rem]">
                          <input type="hidden" name="id" value={r.id} />
                          <input name="title" defaultValue={r.title} aria-label="Routine item" className="field min-w-[12rem] flex-1" />
                          <input name="at_time" type="time" defaultValue={r.at_time?.slice(0, 5) ?? ""} aria-label="Time" className="field w-32" />
                          <button className="btn-quiet">Save</button>
                          <DeleteButton action={deleteRhythm.bind(null, r.id)} label="Remove" />
                        </form>
                      </details>
                    </li>
                  ))}
                </ul>
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
