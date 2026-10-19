import { createClient } from "@/lib/supabase/server";
import { today, addDays, weekdayOf } from "@/lib/dates";
import { addPractice, deletePractice, renamePractice } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";

const SUGGESTED_PRACTICES = ["Pottery", "Art", "DJing", "Cooking", "Hosting"];

/** Practices: the aligned actions you come back to, which feed your projects. */
export async function Practices() {
  const supabase = await createClient();
  const day = today();
  const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7));
  const [practicesRes, links, done] = await Promise.all([
    supabase.from("practices").select("id, name, description").order("sort").order("created_at"),
    supabase.from("project_practices").select("project_id, practice_id"),
    supabase.from("tasks").select("practice_id, completed_at").eq("status", "done").gte("completed_at", weekStart),
  ]);
  const practices = practicesRes.error ? null : practicesRes.data ?? [];
  const pairs = links.error ? [] : links.data ?? [];
  const all = (done.error ? [] : done.data ?? []) as { practice_id: string | null; completed_at: string | null; status?: string }[];
  const missing = SUGGESTED_PRACTICES.filter((n) => !(practices ?? []).some((p) => p.name.toLowerCase() === n.toLowerCase()));

  return (
      <section aria-labelledby="practices">
        <h2 id="practices" className="section-title">practices</h2>
        {practices === null ? (
          <p className="mt-2 text-sm text-muted">Run the 0004 setup file in Supabase to turn on practices.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">The aligned actions you come back to. Link them to projects and to your routine.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {practices.map((p) => {
                const feeds = pairs.filter((l) => l.practice_id === p.id).length;
                const sessions = all.filter((t) => t.practice_id === p.id).length;
                return (
                  <li key={p.id} className="pebble border border-line px-4 py-2.5">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-muted tabular-nums">
                      {sessions} this week{feeds ? `, feeds ${feeds} project${feeds === 1 ? "" : "s"}` : ""}
                    </span>
                  </li>
                );
              })}
              {!practices.length && <li className="text-muted">No practices yet. Add the things you do, not the things you&rsquo;re building.</li>}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {missing.map((name) => (
                <form key={name} action={addPractice}>
                  <input type="hidden" name="name" value={name} />
                  <button className="btn-quiet">Add {name}</button>
                </form>
              ))}
              <form action={addPractice} className="flex min-w-[14rem] flex-1 gap-2">
                <input name="name" required placeholder="Another practice" aria-label="New practice" className="field min-w-0 flex-1" />
                <button className="btn">Add</button>
              </form>
            </div>

            {practices.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">Edit practices</summary>
                <ul className="mt-3 space-y-3">
                  {practices.map((p) => (
                    <li key={p.id}>
                      <form action={renamePractice} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <input name="name" defaultValue={p.name} aria-label="Practice name" className="field w-40" />
                        <input name="description" defaultValue={p.description} placeholder="What it means to you (optional)" aria-label="Description" className="field min-w-0 flex-1" />
                        <button className="btn-quiet">Save</button>
                        <DeleteButton action={deletePractice.bind(null, p.id)} label="Remove" />
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

  );
}
