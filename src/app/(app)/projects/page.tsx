import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { saveProject } from "@/app/actions";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

type Task = { project_id: string; title: string; day: string | null; status: string; completed_at: string | null };
type Goal = { id: string; project_id: string; title: string; metric: string | null; target: number | null; current: number };

function since(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const day = today();
  const [projects, goals, tasks, visions] = await Promise.all([
    supabase.from("projects").select("id, title, description, status, status_note, makes_money").order("created_at"),
    supabase.from("goals").select("id, project_id, title, metric, target, current").eq("status", "active"),
    supabase.from("tasks").select("project_id, title, day, status, completed_at").not("project_id", "is", null).in("status", ["todo", "done"]).order("day", { ascending: true, nullsFirst: false }),
    supabase.from("visions").select("id, title").eq("status", "active"),
  ]);

  const all = (tasks.data ?? []) as Task[];
  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const resting = (projects.data ?? []).filter((p) => p.status !== "active");

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl">Projects</h1>
          <p className="mt-1 max-w-[52ch] text-muted">What&rsquo;s moving, what&rsquo;s next, and what&rsquo;s gone quiet.</p>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {active.map((p, i) => {
          const mine = all.filter((t) => t.project_id === p.id);
          const todo = mine.filter((t) => t.status === "todo");
          const todayCount = todo.filter((t) => t.day && t.day <= day).length;
          const nextCount = todo.filter((t) => t.day && t.day > day).length;
          const laterCount = todo.filter((t) => !t.day).length;
          const next = todo.find((t) => t.day && t.day <= day) ?? todo.find((t) => t.day) ?? todo[0];
          const lastDone = mine.filter((t) => t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0]?.completed_at ?? null;
          const quiet = !lastDone || Date.now() - new Date(lastDone).getTime() > 10 * 86400_000;
          const pg = ((goals.data ?? []) as Goal[]).filter((g) => g.project_id === p.id).slice(0, 2);

          return (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className={`${i % 2 ? "pebble-alt" : "pebble"} flex h-full flex-col bg-surface p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--ink)]`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-xl leading-tight">{p.title}</h2>
                  {p.makes_money && <span className="shrink-0 text-xs text-muted">income</span>}
                </div>
                <p className={`mt-1 text-xs ${quiet ? "text-ink" : "text-muted"}`}>
                  {lastDone ? `Last worked on ${since(lastDone)}` : "Nothing finished yet"}
                  {quiet && lastDone ? ", gone quiet" : ""}
                </p>

                <div className="mt-4">
                  <p className="text-xs text-muted">Next step</p>
                  <p className="mt-0.5 leading-snug">{next ? next.title : <span className="text-muted">None set. Open it and add one.</span>}</p>
                </div>

                {pg.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {pg.map((g) => {
                      const pct = g.target ? Math.min(100, (Number(g.current) / Number(g.target)) * 100) : 0;
                      return (
                        <div key={g.id}>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="truncate">{g.title}</span>
                            {g.target != null && <span className="shrink-0 text-muted tabular-nums">{Number(g.current)}/{Number(g.target)}</span>}
                          </div>
                          {g.target != null && (
                            <div className="mt-1 h-[2px] bg-line">
                              <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="mt-auto pt-5 text-xs text-muted tabular-nums">
                  {todayCount} today, {nextCount} up next, {laterCount} later
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {!active.length && <p className="text-muted">No active projects. Start one below, or bring one back from the list.</p>}

      <details className="pebble border border-dashed border-line p-5">
        <summary className="cursor-pointer font-medium">Start a project</summary>
        <form action={saveProject} className="mt-4 space-y-4">
          <input name="title" required placeholder="Name" aria-label="Project name" className="field" />
          <textarea name="description" rows={3} placeholder="What it is and what it's for" aria-label="Description" className="field" />
          <div className="flex flex-wrap items-center gap-4">
            <Select
              name="vision_id"
              label="Vision"
              className="w-56"
              options={[{ value: "", label: "Serves which vision?" }, ...(visions.data ?? []).map((v) => ({ value: v.id, label: v.title }))]}
            />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" /> Can make money</label>
          </div>
          <button className="btn">Create project</button>
        </form>
      </details>

      {resting.length > 0 && (
        <section aria-labelledby="resting">
          <h2 id="resting" className="section-title">paused, finished and eliminated</h2>
          <ul className="mt-3 divide-y divide-line">
            {resting.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:text-ink">
                  <span className="text-muted">{p.title}{p.status_note ? <span className="text-sm">: {p.status_note}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted capitalize">{p.status === "done" ? "finished" : p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
