import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today, addDays, weekdayOf } from "@/lib/dates";
import { addPractice, deletePractice, renamePractice, saveProject, setVisionStatus, loadMyVisions } from "@/app/actions";
import { MY_VISIONS } from "@/lib/visions";
import { ProjectCard, PracticePicker, VisionForm, type CardData } from "@/components/PlanParts";
import { ActionButton, DeleteButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

const SUGGESTED_PRACTICES = ["Pottery", "Art", "DJing", "Cooking", "Hosting"];

type Task = { project_id: string | null; practice_id: string | null; title: string; day: string | null; status: string; completed_at: string | null };

export default async function PlanPage() {
  const supabase = await createClient();
  const day = today();
  const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7));

  const [visions, projects, goals, tasks, practicesRes, links] = await Promise.all([
    supabase.from("visions").select("*").order("created_at"),
    supabase.from("projects").select("id, title, status, status_note, makes_money, vision_id").order("created_at"),
    supabase.from("goals").select("id, project_id, title, target, current").eq("status", "active"),
    supabase.from("tasks").select("project_id, practice_id, title, day, status, completed_at").in("status", ["todo", "done"]).order("day", { ascending: true, nullsFirst: false }),
    supabase.from("practices").select("id, name, description").order("sort").order("created_at"),
    supabase.from("project_practices").select("project_id, practice_id"),
  ]);

  // Before the practices table exists (setup step not run yet), the page still works without them.
  const practices = practicesRes.error ? null : practicesRes.data ?? [];
  const pairs = links.error ? [] : links.data ?? [];
  const all = (tasks.data ?? []) as Task[];
  const practiceName = new Map((practices ?? []).map((p) => [p.id, p.name]));

  const card = (p: { id: string; title: string; makes_money: boolean }, i: number): CardData => {
    const mine = all.filter((t) => t.project_id === p.id);
    const todo = mine.filter((t) => t.status === "todo");
    return {
      id: p.id,
      title: p.title,
      makesMoney: p.makes_money,
      lastDone: mine.filter((t) => t.completed_at).map((t) => t.completed_at!).sort().pop() ?? null,
      next: (todo.find((t) => t.day && t.day <= day) ?? todo.find((t) => t.day) ?? todo[0])?.title ?? null,
      practices: pairs.filter((l) => l.project_id === p.id).map((l) => practiceName.get(l.practice_id)).filter((n): n is string => !!n),
      goals: (goals.data ?? []).filter((g) => g.project_id === p.id).slice(0, 2).map((g) => ({ id: g.id, title: g.title, current: Number(g.current), target: g.target == null ? null : Number(g.target) })),
      counts: {
        today: todo.filter((t) => t.day && t.day <= day).length,
        next: todo.filter((t) => t.day && t.day > day).length,
        later: todo.filter((t) => !t.day).length,
      },
      shape: i % 2 ? "pebble-alt" : "pebble",
    };
  };

  const activeVisions = (visions.data ?? []).filter((v) => v.status === "active");
  const pastVisions = (visions.data ?? []).filter((v) => v.status !== "active");
  const activeProjects = (projects.data ?? []).filter((p) => p.status === "active");
  const resting = (projects.data ?? []).filter((p) => p.status !== "active");
  const loose = activeProjects.filter((p) => !p.vision_id || !activeVisions.some((v) => v.id === p.vision_id));
  const visionsToLoad = MY_VISIONS.filter((mv) => !activeVisions.some((v) => v.title.trim().toLowerCase() === mv.title.toLowerCase()));
  const missing = SUGGESTED_PRACTICES.filter((n) => !(practices ?? []).some((p) => p.name.toLowerCase() === n.toLowerCase()));

  const newProjectForm = (visionId?: string) => (
    <form action={saveProject} className="mt-4 space-y-4">
      {visionId && <input type="hidden" name="vision_id" value={visionId} />}
      <input name="title" required placeholder="Project name" aria-label="Project name" className="field" />
      <textarea name="description" rows={3} placeholder="What it is and what it's for" aria-label="Description" className="field" />
      <PracticePicker practices={practices ?? []} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="makes_money" /> Can make money</label>
      <button className="btn">Create project</button>
    </form>
  );

  return (
    <div className="space-y-16">
      <div>
        <h1 className="font-serif text-3xl">Plan</h1>
        <p className="mt-1 max-w-[56ch] text-muted">Your practices feed your projects, and your projects serve your visions.</p>
      </div>

      {visionsToLoad.length > 0 && (
        <section aria-labelledby="load" className="pebble border border-ink p-5">
          <h2 id="load" className="font-serif text-xl">Your visions are ready</h2>
          <p className="mt-1 text-sm text-muted">
            {MY_VISIONS.map((v) => v.title).join(", ")}. Written from your vision doc and journal. You can edit any of them after loading.
          </p>
          <div className="mt-4">
            <ActionButton action={loadMyVisions} className="btn">Load my visions</ActionButton>
          </div>
        </section>
      )}

      {/* Practices: the aligned actions you return to again and again */}
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
                const sessions = all.filter((t) => t.practice_id === p.id && t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= weekStart).length;
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

      {/* Visions, each with the projects that serve it */}
      {activeVisions.map((v) => {
        const mine = activeProjects.filter((p) => p.vision_id === v.id);
        return (
          <section key={v.id} aria-labelledby={`v-${v.id}`} className="border-t border-line pt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`v-${v.id}`} className="font-serif text-[1.9rem] leading-tight tracking-[-0.01em]">{v.title}</h2>
              <span className="shrink-0 text-sm text-muted">{v.horizon}</span>
            </div>
            {v.body && <p className="mt-2 max-w-[62ch] whitespace-pre-wrap text-muted">{v.body}</p>}

            {mine.length > 0 ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {mine.map((p, i) => <li key={p.id}><ProjectCard p={card(p, i)} /></li>)}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-muted">No projects serving this vision yet.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <details>
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">Add a project to this vision</summary>
                {newProjectForm(v.id)}
              </details>
              <details>
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">Edit vision</summary>
                <VisionForm v={v} />
                <div className="mt-3 flex gap-2">
                  <ActionButton action={setVisionStatus.bind(null, v.id, "realized")}>Realized</ActionButton>
                  <ActionButton action={setVisionStatus.bind(null, v.id, "released")}>Release it</ActionButton>
                </div>
              </details>
            </div>
          </section>
        );
      })}

      {loose.length > 0 && (
        <section aria-labelledby="loose" className="border-t border-line pt-8">
          <h2 id="loose" className="section-title">projects not tied to a vision yet</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {loose.map((p, i) => <li key={p.id}><ProjectCard p={card(p, i)} /></li>)}
          </ul>
        </section>
      )}

      <section aria-label="Add" className="grid gap-4 sm:grid-cols-2">
        <details className="pebble border border-dashed border-line p-5" open={activeVisions.length === 0}>
          <summary className="cursor-pointer font-medium">Add a vision</summary>
          <VisionForm />
        </details>
        <details className="pebble-alt border border-dashed border-line p-5">
          <summary className="cursor-pointer font-medium">Add a project</summary>
          {newProjectForm()}
          <p className="mt-3 text-xs text-muted">Link it to a vision from the project&rsquo;s page.</p>
        </details>
      </section>

      {(resting.length > 0 || pastVisions.length > 0) && (
        <section aria-labelledby="resting">
          <h2 id="resting" className="section-title">paused, finished and let go</h2>
          <ul className="mt-3 divide-y divide-line">
            {resting.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="text-muted">{p.title}{p.status_note ? <span className="text-sm">: {p.status_note}</span> : null}</span>
                  <span className="shrink-0 text-xs text-muted">{p.status === "done" ? "finished" : p.status}</span>
                </Link>
              </li>
            ))}
            {pastVisions.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-muted">{v.title} <span className="text-xs">(vision, {v.status})</span></span>
                <ActionButton action={setVisionStatus.bind(null, v.id, "active")} className="text-xs text-muted hover:text-ink">Bring back</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
