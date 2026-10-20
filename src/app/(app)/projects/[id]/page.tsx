import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectDetail } from "@/components/ProjectDetail";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteProject } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("projects").select("id, title").eq("id", id).maybeSingle();
  if (!p) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <Link href="/projects" className="text-sm text-muted hover:text-ink">Projects</Link>
        <DeleteButton action={deleteProject.bind(null, id, true)} label="Delete project" confirm={`Delete "${p.title}" and its actions?`} />
      </div>
      <ProjectDetail id={id} />
    </div>
  );
}
