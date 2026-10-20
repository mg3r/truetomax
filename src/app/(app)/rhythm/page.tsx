import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { RoutineEditor } from "@/components/Routine";
import type { Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";

export default async function RhythmPage() {
  const supabase = await createClient();
  const day = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6)); // the last seven days, ending today

  const [routines, checks, links] = await Promise.all([
    supabase.from("routines").select("*").order("sort").order("created_at"),
    supabase.from("routine_checks").select("routine_id, day").gte("day", week[0]),
    supabase.from("routine_projects").select("routine_id, project_id"),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-3xl">Rhythm</h1>
      {routines.error ? (
        <p className="text-muted">Run <code>0009_routine.sql</code> in Supabase to turn this on.</p>
      ) : (
        <RoutineEditor
          items={(routines.data ?? []) as Routine[]}
          checks={checks.data ?? []}
          week={week}
          links={links.error ? null : links.data ?? []}
        />
      )}
    </div>
  );
}
