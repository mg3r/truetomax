import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { JournalForm } from "@/components/JournalForm";
import { JournalEntry } from "@/components/JournalEntry";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteJournal } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase.from("journal_entries").select("id, day, prompt, body, created_at, updated_at").order("day", { ascending: false }).order("created_at", { ascending: false }).limit(60);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-serif text-3xl">Journal</h1>
        <div className="mt-5">
          <JournalForm day={today()} placeholder="What's on your mind?" />
        </div>
      </section>

      <section aria-label="Past entries" className="space-y-8">
        {(entries ?? []).map((e) => (
          <article key={e.id} className="border-t border-line pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <JournalEntry e={e} />
              </div>
              <DeleteButton action={deleteJournal.bind(null, e.id)} label="Delete" confirm="Delete this entry? This can't be undone." />
            </div>
          </article>
        ))}
        {!entries?.length && <p className="text-muted">No entries yet. Today&rsquo;s question on the Today page is a good place to start.</p>}
      </section>
    </div>
  );
}
