import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "@/app/actions";
import { GoalBar } from "@/components/Goals";

export const dynamic = "force-dynamic";

const GROUPS = [
  { status: "active", title: "Active" },
  { status: "paused", title: "Paused" },
  { status: "done", title: "Finished" },
  { status: "eliminated", title: "Eliminated" },
];

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [projects, goals, tasks, visions] = await Promise.all([
    supabase.from("projects").select("id, title, description, status, status_note, makes_money").order("created_at"),
    supabase.from("goals").select("id, project_id, title, metric, target, current, status").eq("status", "active"),
    supabase.from("tasks").select("project_id").eq("status", "todo"),
    supabase.from("visions").select("id, title").eq("status", "active"),
  ]);

  const openCount = new Map<string, number>();
  (tasks.data ?? []).forEach((t) => t.project_id && openCount.set(t.project_id, (openCount.get(t.project_id) ?? 0) + 1));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl">Projects</h1>
        <p className="mt-1 text-muted">The work behind your visions. Pause or eliminate what isn&rsquo;t pulling its weight.</p>
      </div>

      {GROUPS.map(({ status, title }) => {
        const list = (projects.data ?? []).filter((p) => p.status === status);
        if (!list.length) return null;
        const quiet = status !== "active";
        return (
          <section key={status} aria-labelledby={`g-${status}`}>
            <h2 id={`g-${status}`} className="section-title">{title}</h2>
            <ul className="mt-3 space-y-3">
              {list.map((p) => {
                const pg = (goals.data ?? []).filter((g) => g.project_id === p.id);
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className={`block pebble p-4 transition-colors ${quiet ? "border border-line hover:bg-surface" : "bg-surface hover:ring-1 hover:ring-line"}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className={`font-semibold ${quiet ? "text-muted" : ""}`}>{p.title}</h3>
                        <span className="shrink-0 text-xs text-muted">
                          {[p.makes_money && "income", openCount.get(p.id) && `${openCount.get(p.id)} open`].filter(Boolean).join(", ")}
                        </span>
                      </div>
                      {quiet && p.status_note ? (
                        <p className="mt-1 text-sm text-muted">{p.status_note}</p>
                      ) : (
                        p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
                      )}
                      {!quiet && pg.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {pg.slice(0, 3).map((g) => <GoalBar key={g.id} goal={g} compact />)}
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <details className="pebble border border-dashed border-line p-4">
        <summary className="cursor-pointer font-semibold">Start a project</summary>
        <form action={saveProject} className="mt-4 space-y-3">
          <input name="title" required placeholder="Name" aria-label="Project name" className="field" />
          <textarea name="description" rows={3} placeholder="What it is and what it's for" aria-label="Description" className="field" />
          <div className="flex flex-wrap gap-3">
            <select name="vision_id" aria-label="Vision" className="field w-auto">
              <option value="">Serves which vision?</option>
              {(visions.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" /> Can make money</label>
          </div>
          <button className="btn">Create project</button>
        </form>
      </details>
    </div>
  );
}
