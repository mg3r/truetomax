import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today as todayOf, addDays } from "@/lib/dates";
import { TaskList, type ListTask } from "@/components/TaskList";
import { TaskImport } from "@/components/TaskImport";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const supabase = await createClient();
  const day = todayOf();

  // Every one-time task: open ones, plus what you finished in the last two weeks. Things that repeat live on Schedule.
  const [open, done, projectRows] = await Promise.all([
    supabase.from("tasks").select("id, title, status, day, project_id").eq("status", "todo").neq("source", "rhythm").order("created_at"),
    supabase
      .from("tasks")
      .select("id, title, status, day, project_id")
      .eq("status", "done")
      .neq("source", "rhythm")
      .gte("completed_at", addDays(day, -14))
      .order("completed_at", { ascending: false })
      .limit(40),
    supabase.from("projects").select("id, title").in("status", ["active", "paused"]).order("created_at"),
  ]);
  const projects = projectRows.data ?? [];
  const filter = projects.some((p) => p.id === project) ? project! : null;
  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as ListTask[];

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">Actions</h1>
        <TaskImport projectId={filter} />
      </div>

      {projects.length > 0 && (
        <nav className="flex flex-wrap gap-1" aria-label="Filter by project">
          <Link href="/actions" className={`rounded-full px-3 py-1 text-sm ${!filter ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>All</Link>
          {projects.map((p) => (
            <Link key={p.id} href={`/actions?project=${p.id}`} className={`rounded-full px-3 py-1 text-sm ${filter === p.id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
              {p.title}
            </Link>
          ))}
        </nav>
      )}

      <TaskList key={filter ?? "all"} tasks={tasks} projects={projects} today={day} filter={filter} />
    </div>
  );
}
