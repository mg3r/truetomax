import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { saveProject, setProjectStatus } from "@/app/actions";
import { GoalBar, AddGoal } from "@/components/Goals";
import { Board, type BoardTask } from "@/components/Board";
import { Select } from "@/components/Select";
import { PracticePicker } from "@/components/PlanParts";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { active: "Active", paused: "Paused", done: "Finished", eliminated: "Eliminated" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const day = today();

  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [goals, open, done, visions, practicesRes, links] = await Promise.all([
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
    supabase.from("practices").select("id, name").order("sort").order("created_at"),
    supabase.from("project_practices").select("practice_id").eq("project_id", id),
  ]);
  const practices = practicesRes.error ? [] : practicesRes.data ?? [];
  const linked = links.error ? [] : (links.data ?? []).map((l) => l.practice_id);
  const practiceNames = practices.filter((pr) => linked.includes(pr.id)).map((pr) => pr.name);

  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as BoardTask[];
  const vision = (visions.data ?? []).find((v) => v.id === p.vision_id);

  return (
    <div className="space-y-12">
      <div>
        <Link href="/plan" className="text-sm text-muted hover:text-ink">Plan</Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-3xl">{p.title}</h1>
          <span className="text-sm text-muted">
            {[STATUS_LABEL[p.status], p.makes_money && "can make money", vision && `serves ${vision.title}`, practiceNames.length && `fed by ${practiceNames.join(", ")}`].filter(Boolean).join(", ")}
          </span>
        </div>
        {p.status !== "active" && p.status_note && <p className="mt-2 text-sm text-muted">{p.status_note}</p>}
        {p.description && <p className="mt-3 max-w-[62ch] whitespace-pre-wrap text-muted">{p.description}</p>}
      </div>

      <section aria-labelledby="goals">
        <h2 id="goals" className="section-title">goals</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(goals.data ?? []).map((g) => <GoalBar key={g.id} goal={g} />)}
        </div>
        {!goals.data?.length && <p className="mt-2 text-muted">No goals yet. What would make this project a success in the next 90 days?</p>}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">Add a goal</summary>
          <AddGoal projectId={id} />
        </details>
      </section>

      <section aria-labelledby="board">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="board" className="section-title">the work</h2>
          <p className="text-xs text-muted">Drag cards between lanes, or tap one to move it.</p>
        </div>
        <div className="mt-4">
          <Board projectId={id} tasks={tasks} today={day} />
        </div>
      </section>

      <section aria-labelledby="direction" className="pebble border border-line p-4 sm:p-5">
        <h2 id="direction" className="section-title">keep, pause, or let go</h2>
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
              className="w-56"
              defaultValue={p.vision_id ?? ""}
              options={[{ value: "", label: "No vision" }, ...(visions.data ?? []).map((v) => ({ value: v.id, label: v.title }))]}
            />
            <input name="area" defaultValue={p.area} aria-label="Area" placeholder="Area" className="field w-36" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" defaultChecked={p.makes_money} /> Can make money</label>
          </div>
          <PracticePicker practices={practices} selected={linked} />
          <button className="btn">Save changes</button>
        </form>
      </details>
    </div>
  );
}
