import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, shortDay } from "@/lib/dates";
import { saveProject, setProjectStatus, scheduleTask } from "@/app/actions";
import { GoalBar, AddGoal } from "@/components/Goals";
import { TaskRow, AddTask } from "@/components/Tasks";
import { ActionButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const day = today();

  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [goals, tasks, visions] = await Promise.all([
    supabase.from("goals").select("*").eq("project_id", id).neq("status", "dropped").order("created_at"),
    supabase.from("tasks").select("id, title, status, source, reason, day").eq("project_id", id).in("status", ["todo", "done"]).order("day", { ascending: true, nullsFirst: false }).limit(80),
    supabase.from("visions").select("id, title").eq("status", "active"),
  ]);

  const open = (tasks.data ?? []).filter((t) => t.status === "todo");
  const scheduled = open.filter((t) => t.day);
  const backlog = open.filter((t) => !t.day);
  const done = (tasks.data ?? []).filter((t) => t.status === "done").slice(-10).reverse();

  return (
    <div className="space-y-10">
      <div>
        <Link href="/projects" className="text-sm text-muted hover:text-ink">Projects</Link>
        <h1 className="mt-1 font-serif text-3xl">{p.title}</h1>
        {p.status !== "active" && (
          <p className="mt-2 text-sm text-muted">
            {p.status === "eliminated" ? "Eliminated" : p.status === "paused" ? "Paused" : "Finished"}
            {p.status_note ? `: ${p.status_note}` : ""}
          </p>
        )}
        {p.description && <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-muted">{p.description}</p>}
      </div>

      <section aria-labelledby="goals">
        <h2 id="goals" className="section-title">Goals</h2>
        <div className="mt-3 space-y-5">
          {(goals.data ?? []).map((g) => <GoalBar key={g.id} goal={g} />)}
          {!goals.data?.length && <p className="text-muted">No goals yet. What would make this project a success in the next 90 days?</p>}
        </div>
        <AddGoal projectId={id} />
      </section>

      <section aria-labelledby="work">
        <h2 id="work" className="section-title">Work</h2>
        {scheduled.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {scheduled.map((t) => (
              <TaskRow key={t.id} task={t} today={day} showProject={false} aside={<span className="text-xs text-muted">{t.day === day ? "Today" : shortDay(t.day!)}</span>} />
            ))}
          </ul>
        )}
        <AddTask projectId={id} placeholder="Add a task" allowBacklog />

        {backlog.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold text-muted">Later</h3>
            <ul className="divide-y divide-line">
              {backlog.map((t) => (
                <TaskRow key={t.id} task={t} showProject={false} aside={<ActionButton action={scheduleTask.bind(null, t.id, day)}>Do today</ActionButton>} />
              ))}
            </ul>
          </>
        )}

        {done.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold text-muted">Recently done</h3>
            <ul className="divide-y divide-line">{done.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}</ul>
          </>
        )}
      </section>

      <section aria-labelledby="direction" className="pebble bg-surface p-4 sm:p-5">
        <h2 id="direction" className="section-title">Keep, pause, or let go</h2>
        <p className="mt-1 text-sm text-muted">Saying why helps your partner stop suggesting what you&rsquo;ve already ruled out.</p>
        <form action={setProjectStatus} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={id} />
          <input name="note" defaultValue={p.status_note ?? ""} placeholder="Why? (optional)" aria-label="Reason" className="field" />
          <div className="flex flex-wrap gap-2">
            {[
              ["active", "Keep active"],
              ["paused", "Pause"],
              ["done", "Mark finished"],
              ["eliminated", "Eliminate"],
            ].map(([s, label]) => (
              <button key={s} name="status" value={s} className={s === p.status ? "btn" : "btn-quiet"}>{label}</button>
            ))}
          </div>
        </form>
      </section>

      <details className="pebble border border-line p-4">
        <summary className="cursor-pointer font-semibold">Edit project</summary>
        <form action={saveProject} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={id} />
          <input name="title" required defaultValue={p.title} aria-label="Name" className="field" />
          <textarea name="description" rows={4} defaultValue={p.description} aria-label="Description" className="field" />
          <div className="flex flex-wrap gap-3">
            <select name="vision_id" defaultValue={p.vision_id ?? ""} aria-label="Vision" className="field w-auto">
              <option value="">No vision</option>
              {(visions.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <input name="area" defaultValue={p.area} aria-label="Area" placeholder="Area" className="field w-36" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" defaultChecked={p.makes_money} /> Can make money</label>
          </div>
          <button className="btn">Save changes</button>
        </form>
      </details>
    </div>
  );
}
