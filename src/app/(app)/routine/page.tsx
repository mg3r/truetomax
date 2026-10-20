import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { RoutineEditor } from "@/components/Routine";
import type { Routine } from "@/lib/routine";

export const dynamic = "force-dynamic";

export default async function RoutinePage() {
  const supabase = await createClient();
  const day = today();
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6)); // the last seven days, ending today

  const [routines, checks] = await Promise.all([
    supabase.from("routines").select("*").order("sort").order("created_at"),
    supabase.from("routine_checks").select("routine_id, day").gte("day", week[0]),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl">Routine</h1>
        <p className="mt-1 max-w-[56ch] text-muted">What you do every day, every night, and on certain days. It shows up on Today to tick off, and on your Schedule.</p>
      </div>
      {routines.error ? (
        <p className="text-muted">Run <code>0009_routine.sql</code> in Supabase to turn this on.</p>
      ) : (
        <RoutineEditor items={(routines.data ?? []) as Routine[]} checks={checks.data ?? []} week={week} />
      )}
    </div>
  );
}
