import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { AskPartner } from "@/components/AskPartner";
import { ProjectBoard, type BoardProject } from "@/components/ProjectBoard";
import { NewProject } from "@/components/NewProject";

export const dynamic = "force-dynamic";

type Task = { project_id: string; title: string; day: string | null };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const day = today();

  const [projects, tasks] = await Promise.all([
    supabase.from("projects").select("id, title, status").order("created_at"),
    supabase.from("tasks").select("project_id, title, day").not("project_id", "is", null).eq("status", "todo").order("day", { ascending: true, nullsFirst: false }),
  ]);

  const all = (tasks.data ?? []) as Task[];
  const board: BoardProject[] = (projects.data ?? []).map((p) => {
    const todo = all.filter((t) => t.project_id === p.id);
    const next = todo.find((t) => t.day && t.day <= day) ?? todo.find((t) => t.day === "9999-12-31") ?? todo.find((t) => t.day) ?? todo[0];
    return { id: p.id, title: p.title, status: p.status, next: next?.title ?? null, open: todo.length };
  });

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">Projects</h1>

      <div className="space-y-3">
        <NewProject />
        <AskPartner
          endpoint="/api/ideas"
          body={{ kind: "venture" }}
          label="Suggest ideas"
          busyLabel="Thinking it through…"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        />
      </div>

      {/* The board is wider than the page's reading column on a computer, so four columns have room. */}
      <div className="lg:relative lg:left-1/2 lg:w-[min(68rem,calc(100vw-18rem))] lg:-translate-x-1/2">
        <ProjectBoard projects={board} />
      </div>
    </div>
  );
}
