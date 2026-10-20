import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { type BoardTask } from "./Board";
import { TaskPanel } from "./TaskPanel";
import { ProjectSuggestions } from "./ProjectSuggestions";
import { loadPractices } from "@/lib/routine";
import { ProjectHeader, GoalList } from "./ProjectEditor";

/**
 * Everything about one project, in order: title, description and status, then goals, actions,
 * and the next steps your partner suggests. Used in the side panel on Projects and on the project's own page.
 */
export async function ProjectDetail({ id }: { id: string }) {
  const supabase = await createClient();
  const day = today();
  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) return <p className="text-muted">This project isn&rsquo;t here anymore.</p>;

  // An action can be in several projects; before the 0022 setup runs, only the single link exists.
  const probe = await supabase.from("tasks").select("id").contains("project_ids", [id]).limit(1);
  const inThis = () => (probe.error ? supabase.from("tasks").select("*").eq("project_id", id) : supabase.from("tasks").select("*").or(`project_id.eq.${id},project_ids.cs.{${id}}`));
  const [goals, open, done, suggested, practices] = await Promise.all([
    supabase.from("goals").select("id, title, status").eq("project_id", id).neq("status", "dropped").order("created_at"),
    inThis().eq("status", "todo").order("created_at"),
    inThis().eq("status", "done").gte("completed_at", addDays(day, -14)).order("completed_at", { ascending: false }).limit(20),
    inThis().eq("status", "suggested").is("day", null).order("created_at"),
    loadPractices(supabase),
  ]);
  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as BoardTask[];

  return (
    <div className="space-y-10">
      <ProjectHeader key={`${p.id}-${p.status}`} p={p} />

      <section aria-labelledby={`goals-${id}`}>
        <h2 id={`goals-${id}`} className="section-title">goals</h2>
        <div className="mt-1">
          <GoalList projectId={id} goals={goals.data ?? []} />
        </div>
      </section>

      <section aria-labelledby={`actions-${id}`}>
        <h2 id={`actions-${id}`} className="section-title">actions</h2>
        <div className="mt-3">
          <TaskPanel projectId={id} tasks={tasks} today={day} practices={practices} />
        </div>
      </section>

      <section aria-labelledby={`suggested-${id}`}>
        <h2 id={`suggested-${id}`} className="section-title">suggested next steps</h2>
        <div className="mt-2">
          <ProjectSuggestions projectId={id} steps={suggested.data ?? []} today={day} practices={practices} />
        </div>
      </section>
    </div>
  );
}
