import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { saveProject, deleteProject } from "@/app/actions";
import { RemoveX } from "@/components/RemoveX";
import { AskPartner } from "@/components/AskPartner";
import { ProjectCard, type CardData } from "@/components/PlanParts";

export const dynamic = "force-dynamic";

type Task = { project_id: string; title: string; day: string | null; status: string };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const day = today();

  const [projects, tasks] = await Promise.all([
    supabase.from("projects").select("id, title, status, status_note").order("created_at"),
    supabase.from("tasks").select("project_id, title, day, status").not("project_id", "is", null).eq("status", "todo").order("day", { ascending: true, nullsFirst: false }),
  ]);

  const all = (tasks.data ?? []) as Task[];
  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const resting = (projects.data ?? []).filter((p) => p.status !== "active");

  const card = (p: (typeof active)[number], i: number): CardData => {
    const todo = all.filter((t) => t.project_id === p.id);
    return {
      id: p.id,
      title: p.title,
      next: (todo.find((t) => t.day && t.day <= day) ?? todo.find((t) => t.day) ?? todo[0])?.title ?? null,
      counts: {
        today: todo.filter((t) => t.day && t.day <= day).length,
        next: todo.filter((t) => t.day && t.day > day).length,
        later: todo.filter((t) => !t.day).length,
      },
      shape: i % 2 ? "pebble-alt" : "pebble",
    };
  };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Projects</h1>
      </div>

      <details id="new" className="pebble scroll-mt-6 border border-dashed border-line p-5" open={!active.length}>
        <summary className="cursor-pointer font-medium">Start a project</summary>
        <form action={saveProject} className="mt-4 space-y-4">
          <input name="title" required placeholder="Project name" aria-label="Project name" className="field" />
          <textarea name="description" rows={3} placeholder="What it is and what it's for" aria-label="Description" className="field" />
          <button className="btn">Create project</button>
        </form>
      </details>

      {active.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {active.map((p, i) => (
            <li key={p.id} className="relative">
              <ProjectCard p={card(p, i)} />
              <RemoveX action={deleteProject.bind(null, p.id, false)} label={`Delete ${p.title}`} confirm={`Delete "${p.title}" and its actions?`} className="absolute top-3 right-3" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No projects yet. Start one above.</p>
      )}


      {[
        { title: "backlog", list: resting.filter((p) => p.status === "paused") },
        { title: "done", list: resting.filter((p) => p.status !== "paused") },
      ]
        .filter((g) => g.list.length || g.title === "backlog")
        .map((g) => (
          <section key={g.title} aria-label={g.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="section-title">{g.title}</h2>
              {g.title === "backlog" && (
                <AskPartner
                  endpoint="/api/ideas"
                  body={{ kind: "venture" }}
                  label="Suggest ideas"
                  busyLabel="Thinking it through…"
                  className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
                />
              )}
            </div>
            {g.title === "backlog" && !g.list.length && (
              <p className="mt-1 text-sm text-muted">Ideas for work and income land here. Start one when it&rsquo;s alive, or delete it and it won&rsquo;t be suggested again.</p>
            )}
            <ul className="mt-2 divide-y divide-line">
              {g.list.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Link href={`/projects/${p.id}`} className="flex min-w-0 flex-1 items-baseline justify-between gap-4 py-2.5">
                    <span className="text-muted">{p.title}{p.status_note ? <span className="text-sm">: {p.status_note}</span> : null}</span>
                  </Link>
                  <RemoveX action={deleteProject.bind(null, p.id, false)} label={`Delete ${p.title}`} confirm={`Delete "${p.title}" and its actions?`} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
