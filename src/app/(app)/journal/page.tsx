import { createClient } from "@/lib/supabase/server";
import { prettyDay, today } from "@/lib/dates";
import { JournalForm } from "@/components/JournalForm";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteJournal } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase.from("journal_entries").select("id, day, prompt, body").order("day", { ascending: false }).order("created_at", { ascending: false }).limit(60);

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
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-sm text-muted">{prettyDay(e.day)}</h2>
              <DeleteButton action={deleteJournal.bind(null, e.id)} label="Delete entry" confirm="Delete this entry? This can't be undone." />
            </div>
            {e.prompt && <p className="mt-2 font-serif italic text-muted">{e.prompt}</p>}
            <div className="mt-2 max-w-[65ch] font-serif text-lg leading-relaxed whitespace-pre-wrap">{e.body}</div>
          </article>
        ))}
        {!entries?.length && <p className="text-muted">No entries yet. Today&rsquo;s question on the Today page is a good place to start.</p>}
      </section>
    </div>
  );
}
