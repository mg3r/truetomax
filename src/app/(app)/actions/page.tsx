import Link from "next/link";
import { projectsOf } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { today as todayOf, addDays } from "@/lib/dates";
import { TaskList, type ListTask } from "@/components/TaskList";
import { ImportDialog } from "@/components/ImportDialog";
import { IdeaList } from "@/components/IdeaList";
import { loadPractices } from "@/lib/routine";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ project?: string; open?: string }> }) {
  const { project, open: openId } = await searchParams;
  const supabase = await createClient();
  const day = todayOf();

  // Every one-time task: open ones, plus what you finished in the last two weeks. Things that repeat live on Schedule.
  const [open, done, projectRows] = await Promise.all([
    supabase.from("tasks").select("*").eq("status", "todo").neq("source", "rhythm").order("created_at"),
    supabase
      .from("tasks")
      .select("*")
      .eq("status", "done")
      .neq("source", "rhythm")
      .gte("completed_at", addDays(day, -14))
      .order("completed_at", { ascending: false })
      .limit(40),
    supabase.from("projects").select("id, title, status").order("created_at"),
  ]);
  const practices = await loadPractices(supabase);
  const ideaRows = await supabase.from("ideas").select("id, title, body, first_step, money_path").eq("kind", "action").in("status", ["new", "exploring"]).order("created_at", { ascending: false });
  // Every action shows, whatever its project's status; any project can be picked for one.
  const allProjects = projectRows.data ?? [];
  const projects = allProjects;
  const tasks = [...(open.data ?? []), ...(done.data ?? [])] as ListTask[];
  // The filter row lists only projects that have actions here, so it stays short.
  const withActions = new Set(tasks.flatMap((t) => projectsOf(t)));
  const filterable = projects.filter((p) => withActions.has(p.id));
  const filter = filterable.some((p) => p.id === project) ? project! : null;

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">Actions</h1>
        <ImportDialog kind="actions" projectId={filter} />
      </div>

      {filterable.length > 0 && (
        <nav className="flex flex-wrap gap-1" aria-label="Filter by project">
          <Link href="/actions" className={`rounded-full px-3 py-1 text-sm ${!filter ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>All</Link>
          {filterable.map((p) => (
            <Link key={p.id} href={`/actions?project=${p.id}`} className={`rounded-full px-3 py-1 text-sm ${filter === p.id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
              {p.title}
            </Link>
          ))}
        </nav>
      )}

      <TaskList key={filter ?? "all"} tasks={tasks} projects={projects} practices={practices} today={day} filter={filter} openId={openId ?? null} />

      {/* More actions when Today's suggestions run out. */}
      <div className="pt-6">
        <IdeaList kind="action" ideas={ideaRows.error ? [] : ideaRows.data ?? []} />
      </div>
    </div>
  );
}
