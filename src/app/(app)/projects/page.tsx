import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today, shortDay } from "@/lib/dates";
import { saveProject } from "@/app/actions";
import { PracticePicker } from "@/components/PlanParts";
import { TaskRow, AddTask, type Task } from "@/components/Tasks";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

const SHOWN = 6;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ vision?: string }> }) {
  const { vision: visionParam } = await searchParams;
  const supabase = await createClient();
  const day = today();

  const [projects, tasks, visions, practicesRes] = await Promise.all([
    supabase.from("projects").select("id, title, status, status_note, vision_id").order("created_at"),
    supabase.from("tasks").select("*").not("project_id", "is", null).eq("status", "todo").order("day", { ascending: true, nullsFirst: false }).order("created_at"),
    supabase.from("visions").select("id, title").eq("status", "active").order("created_at"),
    supabase.from("practices").select("id, name").order("sort").order("created_at"),
  ]);

  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const resting = (projects.data ?? []).filter((p) => p.status !== "active");
  const visionName = new Map((visions.data ?? []).map((v) => [v.id, v.title]));
  const practices = practicesRes.error ? [] : practicesRes.data ?? [];

  return (
    <div className="space-y-14">
      <div>
        <h1 className="font-serif text-3xl">Projects</h1>
        <p className="mt-1 max-w-[56ch] text-muted">What you&rsquo;re building, and the tasks that move each one forward.</p>
      </div>

      {active.map((p) => {
        const open = ((tasks.data ?? []) as (Task & { project_id: string })[]).filter((t) => t.project_id === p.id);
        // Today first, then the next few days, then later.
        const ordered = [
          ...open.filter((t) => t.day && t.day <= day),
          ...open.filter((t) => t.day && t.day > day),
          ...open.filter((t) => !t.day),
        ];
        const label = (t: Task) => (!t.day ? "later" : t.day <= day ? "today" : shortDay(t.day));
        return (
          <section key={p.id} aria-labelledby={`p-${p.id}`} className="border-t border-line pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`p-${p.id}`} className="font-serif text-2xl leading-tight">
                <Link href={`/projects/${p.id}`} className="hover:underline hover:decoration-line hover:underline-offset-4">{p.title}</Link>
              </h2>
              <Link href={`/projects/${p.id}`} className="shrink-0 text-sm text-muted hover:text-ink">Open</Link>
            </div>
            <p className="mt-0.5 text-sm text-muted">{p.vision_id && visionName.get(p.vision_id) ? `Serves ${visionName.get(p.vision_id)}` : "Not linked to a vision yet"}</p>

            {ordered.length > 0 ? (
              <ul className="mt-3 divide-y divide-line">
                {ordered.slice(0, SHOWN).map((t) => (
                  <TaskRow key={t.id} task={t} today={day} showProject={false} aside={<span className="text-xs text-muted">{label(t)}</span>} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">No open tasks. What&rsquo;s the next step?</p>
            )}
            {ordered.length > SHOWN && (
              <Link href={`/projects/${p.id}`} className="mt-2 inline-block text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
                {ordered.length - SHOWN} more
              </Link>
            )}
            <AddTask projectId={p.id} placeholder="Add a task" allowBacklog />
          </section>
        );
      })}

      {!active.length && <p className="text-muted">No projects yet. Start one below, or from a vision.</p>}

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
          <PracticePicker practices={practices} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" /> Can make money</label>
          <button className="btn">Create project</button>
        </form>
      </details>

      <p className="text-sm text-muted">
        Looking for what to start? <Link href="/ideas" className="underline decoration-line underline-offset-4 hover:text-ink">See ideas</Link> your partner has surfaced.
      </p>

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
