import { createClient } from "@/lib/supabase/server";
import { today as todayOf, addDays } from "@/lib/dates";
import { mondayOf } from "@/lib/routine";
import { PracticeList, type Practice } from "@/components/Practices";

export const dynamic = "force-dynamic";

export default async function PracticesPage() {
  const supabase = await createClient();
  const day = todayOf();
  const [practices, projects, links, sessions] = await Promise.all([
    supabase.from("practices").select("id, name, sort").order("sort").order("created_at"),
    supabase.from("projects").select("id, title").in("status", ["active", "paused"]).order("created_at"),
    supabase.from("project_practices").select("practice_id, project_id"),
    supabase.from("practice_sessions").select("practice_id, day").gte("day", addDays(day, -90)),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl">Practices</h1>
      {practices.error || sessions.error ? (
        <p className="text-muted">Run <code>0014_practices.sql</code> in Supabase to turn this on.</p>
      ) : (
        <PracticeList
          practices={(practices.data ?? []) as Practice[]}
          projects={projects.data ?? []}
          links={links.data ?? []}
          sessions={sessions.data ?? []}
          today={day}
          weekStart={mondayOf(day)}
        />
      )}
    </div>
  );
}
