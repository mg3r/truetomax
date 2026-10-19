import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { saveProject, setProjectStatus } from "@/app/actions";
import { GoalRow, AddGoal } from "@/components/Goals";
import { type BoardTask } from "@/components/Board";
import { TaskPanel } from "@/components/TaskPanel";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { paused: "Paused", done: "Finished", eliminated: "Eliminated" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const day = today();

  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [goals, open, done, visions] = await Promise.all([
    supabase.from("goals").select("*").eq("project_id", id).neq("status", "dropped").order("created_at"),
    supabase.from("tasks").select("id, title, status, day, source, reason").eq("project_id", id).eq("status", "todo").order("created_at"),
    supabase
      .from("tasks")
      .select("id, title, status, day, source, reason, completed_at")
      .eq("project_id", id)
      .eq("status", "done")
      .gte("completed_at", addDays(day, -14))
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase.from("visions").select("id, title").eq("status", "active"),
  ]);

  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as BoardTask[];
  const vision = (visions.data ?? []).find((v) => v.id === p.vision_id);

  return (
    <div className="space-y-12">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:text-ink">Projects</Link>
        <h1 className="mt-1 font-serif text-3xl">{p.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {[STATUS_LABEL[p.status], vision ? `Serves ${vision.title}` : "Not linked to a vision"].filter(Boolean).join(" · ")}
        </p>
        {p.description && <p className="mt-3 max-w-[62ch] whitespace-pre-wrap text-muted">{p.description}</p>}
      </div>

      <section aria-labelledby="goals">
        <h2 id="goals" className="section-title">goals</h2>
        {(goals.data ?? []).length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {(goals.data ?? []).map((g) => <GoalRow key={g.id} goal={g} />)}
          </ul>
        )}
        <AddGoal projectId={id} />
      </section>

      <section aria-labelledby="tasks">
        <h2 id="tasks" className="section-title">tasks</h2>
        <div className="mt-3">
          <TaskPanel projectId={id} tasks={tasks} today={day} />
        </div>
      </section>

      <details className="pebble-alt border border-line p-4">
        <summary className="cursor-pointer font-medium">Edit project</summary>

        <form action={saveProject} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={id} />
          <input name="title" required defaultValue={p.title} aria-label="Name" className="field" />
          <textarea name="description" rows={4} defaultValue={p.description} aria-label="Description" className="field" />
          <div className="flex flex-wrap items-center gap-4">
            <Select
              name="vision_id"
              label="Vision"
              className="w-64 max-w-full"
              defaultValue={p.vision_id ?? ""}
              options={[{ value: "", label: "No vision" }, ...(visions.data ?? []).map((v) => ({ value: v.id, label: v.title }))]}
            />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" defaultChecked={p.makes_money} /> Can make money</label>
          </div>
          <button className="btn">Save changes</button>
        </form>

        <form action={setProjectStatus} className="mt-8 space-y-3 border-t border-line pt-5">
          <p className="text-sm text-muted">Pause, finish or let it go. Saying why helps your partner stop suggesting it.</p>
          <input type="hidden" name="id" value={id} />
          <input name="note" defaultValue={p.status_note ?? ""} placeholder="Why? (optional)" aria-label="Reason" className="field" />
          <div className="flex flex-wrap gap-2">
            {[
              ["active", "Active"],
              ["paused", "Pause"],
              ["done", "Finished"],
              ["eliminated", "Eliminate"],
            ].map(([s, label]) => (
              <button key={s} name="status" value={s} className={s === p.status ? "btn" : "btn-quiet"}>{label}</button>
            ))}
          </div>
        </form>
      </details>
    </div>
  );
}
