import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { saveProject } from "@/app/actions";
import { ProjectCard, type CardData } from "@/components/PlanParts";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

type Task = { project_id: string; title: string; day: string | null; status: string };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ vision?: string }> }) {
  const { vision: visionParam } = await searchParams;
  const supabase = await createClient();
  const day = today();

  const [projects, tasks, visions] = await Promise.all([
    supabase.from("projects").select("id, title, status, status_note, vision_id").order("created_at"),
    supabase.from("tasks").select("project_id, title, day, status").not("project_id", "is", null).eq("status", "todo").order("day", { ascending: true, nullsFirst: false }),
    supabase.from("visions").select("id, title").eq("status", "active").order("created_at"),
  ]);

  const all = (tasks.data ?? []) as Task[];
  const visionName = new Map((visions.data ?? []).map((v) => [v.id, v.title]));
  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const resting = (projects.data ?? []).filter((p) => p.status !== "active");

  const card = (p: (typeof active)[number], i: number): CardData => {
    const todo = all.filter((t) => t.project_id === p.id);
    return {
      id: p.id,
      title: p.title,
      vision: p.vision_id ? visionName.get(p.vision_id) ?? null : null,
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
        <p className="mt-1 max-w-[56ch] text-muted">What you&rsquo;re building. Open one to see its tasks.</p>
      </div>

      <details id="new" className="pebble scroll-mt-6 border border-dashed border-line p-5" open={!!visionParam || !active.length}>
        <summary className="cursor-pointer font-medium">Start a project</summary>
        <form action={saveProject} className="mt-4 space-y-4">
          <input name="title" required placeholder="Project name" aria-label="Project name" className="field" />
          <textarea name="description" rows={3} placeholder="What it is and what it's for" aria-label="Description" className="field" />
          <Select
            name="vision_id"
            label="Vision"
            className="w-64 max-w-full"
            defaultValue={visionParam ?? ""}
            options={[{ value: "", label: "Which vision does it serve?" }, ...(visions.data ?? []).map((v) => ({ value: v.id, label: v.title }))]}
          />
          <button className="btn">Create project</button>
        </form>
      </details>

      {active.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {active.map((p, i) => (
            <li key={p.id}><ProjectCard p={card(p, i)} /></li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">No projects yet. Start one below, or from a vision.</p>
      )}


      {resting.length > 0 && (
        <section aria-labelledby="resting">
          <h2 id="resting" className="section-title">paused, finished and eliminated</h2>
          <ul className="mt-2 divide-y divide-line">
            {resting.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="text-muted">{p.title}{p.status_note ? <span className="text-sm">: {p.status_note}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted">{p.status === "done" ? "finished" : p.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
