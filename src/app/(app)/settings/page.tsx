import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/dates";
import { saveAboutMe, addHighlight, deleteHighlight, addRhythm, deleteRhythm, signOut } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { BookUpload } from "@/components/BookUpload";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

// Monday-first, the way the week is lived.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [ctx, highlights, rhythm, projects, bookPages] = await Promise.all([
    supabase.from("profile_context").select("about_me, summary, summary_updated_at").maybeSingle(),
    supabase.from("highlights").select("id, text, source, location").order("created_at", { ascending: false }),
    supabase.from("rhythm").select("id, weekday, title, project_id").order("sort").order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active"),
    supabase.from("book_pages").select("book", { count: "exact" }).limit(1),
  ]);
  // Null when no book has been added yet, or before the book table is set up.
  const book = !bookPages.error && bookPages.count ? { book: bookPages.data?.[0]?.book ?? "Your book", pages: bookPages.count } : null;

  return (
    <div className="space-y-14">
      <h1 className="font-serif text-3xl">Setup</h1>

      <section aria-labelledby="about">
        <h2 id="about" className="section-title">About you</h2>
        <p className="mt-1 text-sm text-muted">Your partner reads this before every suggestion. Keep it honest and current.</p>
        <form action={saveAboutMe} className="mt-3 space-y-2">
          <textarea name="about_me" rows={10} defaultValue={ctx.data?.about_me ?? ""} aria-label="About you" className="field" />
          <button className="btn">Save</button>
        </form>
      </section>

      <section aria-labelledby="learned">
        <h2 id="learned" className="section-title">What your partner has learned</h2>
        <p className="mt-1 text-sm text-muted">Patterns it has noticed, rhythm changes it suggests, and its weekly review.</p>
        <Link href="/learned" className="btn-quiet mt-3">Open what it&rsquo;s learned</Link>
      </section>

      <section aria-labelledby="book-h" id="book" className="scroll-mt-6">
        <h2 id="book-h" className="section-title">Your book</h2>
        <p className="mt-1 text-sm text-muted">
          Add your PDF of The Creative Act. It&rsquo;s read on this device and only its text is stored, privately. Each morning Today opens to a page you haven&rsquo;t seen in a while, and the question and affirmation come from it.
        </p>
        <BookUpload existing={book} />
      </section>

      <section aria-labelledby="passages-h" id="passages" className="scroll-mt-6">
        <h2 id="passages-h" className="section-title">Passages</h2>
        <p className="mt-1 text-sm text-muted">Lines you&rsquo;ve marked in your copy of The Creative Act, or any book. One shows up each morning and shapes the day&rsquo;s question.</p>
        <form action={addHighlight} className="mt-3 space-y-2">
          <textarea name="text" rows={3} required placeholder="The passage, exactly as written" aria-label="Passage" className="field" />
          <div className="flex flex-wrap gap-2">
            <input name="source" defaultValue="The Creative Act" aria-label="Book" className="field min-w-0 flex-1" />
            <input name="location" placeholder="Chapter or page" aria-label="Chapter or page" className="field w-40" />
            <button className="btn">Add passage</button>
          </div>
        </form>
        <ul className="mt-5 space-y-4">
          {(highlights.data ?? []).map((h) => (
            <li key={h.id} className="border-t border-line pt-3">
              <p className="font-serif italic">{h.text}</p>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{h.source}{h.location ? `, ${h.location}` : ""}</span>
                <DeleteButton action={deleteHighlight.bind(null, h.id)} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rhythm">
        <h2 id="rhythm" className="section-title">Weekly rhythm</h2>
        <p className="mt-1 text-sm text-muted">These become each day&rsquo;s fixed tasks. Changes apply from tomorrow.</p>
        <div className="mt-4 space-y-5">
          {ORDER.map((wd) => {
            const items = (rhythm.data ?? []).filter((r) => r.weekday === wd);
            return (
              <div key={wd}>
                <h3 className="text-sm font-semibold">{WEEKDAYS[wd]}</h3>
                <ul className="mt-1">
                  {items.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-1">
                      <span>{r.title}</span>
                      <DeleteButton action={deleteRhythm.bind(null, r.id)} label="Remove" />
                    </li>
                  ))}
                  {!items.length && <li className="py-1 text-sm text-muted">Open day</li>}
                </ul>
              </div>
            );
          })}
        </div>
        <form action={addRhythm} className="mt-5 flex flex-wrap gap-2">
          <Select name="weekday" label="Day" className="w-36" defaultValue="1" options={ORDER.map((wd) => ({ value: String(wd), label: WEEKDAYS[wd] }))} />
          <input name="title" required placeholder="Recurring task" aria-label="Recurring task" className="field min-w-0 flex-1" />
          <Select name="project_id" label="Project" className="w-44" options={[{ value: "", label: "No project" }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.title }))]} />
          <button className="btn">Add</button>
        </form>
      </section>

      <form action={signOut}>
        <button className="btn-quiet">Sign out</button>
      </form>
    </div>
  );
}
