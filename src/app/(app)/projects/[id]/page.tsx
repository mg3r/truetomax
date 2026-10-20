import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { type BoardTask } from "@/components/Board";
import { TaskPanel } from "@/components/TaskPanel";
import { ProjectHeader, GoalList } from "@/components/ProjectEditor";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteProject } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const day = today();

  const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [goals, open, done] = await Promise.all([
    supabase.from("goals").select("id, title, status").eq("project_id", id).neq("status", "dropped").order("created_at"),
    supabase.from("tasks").select("id, title, status, day, source, reason").eq("project_id", id).eq("status", "todo").order("created_at"),
    supabase
      .from("tasks")
      .select("id, title, status, day, source, reason, completed_at")
      .eq("project_id", id)
      .eq("status", "done")
      .gte("completed_at", addDays(day, -14))
      .order("completed_at", { ascending: false })
      .limit(20),
  ]);

  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as BoardTask[];

  return (
    <div className="space-y-12">
      <div>
        <div className="flex items-baseline justify-between">
          <Link href="/projects" className="text-sm text-muted hover:text-ink">Projects</Link>
          <DeleteButton action={deleteProject.bind(null, id, true)} label="Delete project" confirm={`Delete "${p.title}" and its tasks?`} />
        </div>
        <ProjectHeader p={p} />
      </div>

      <section aria-labelledby="goals">
        <h2 id="goals" className="section-title">goals</h2>
        <div className="mt-1">
          <GoalList projectId={id} goals={goals.data ?? []} />
        </div>
      </section>

      <section aria-labelledby="tasks">
        <h2 id="tasks" className="section-title">tasks</h2>
        <div className="mt-3">
          <TaskPanel projectId={id} tasks={tasks} today={day} />
        </div>
      </section>
    </div>
  );
}
