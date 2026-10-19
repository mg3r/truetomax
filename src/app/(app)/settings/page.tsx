import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/dates";
import { saveAboutMe, addHighlight, deleteHighlight, addRhythm, deleteRhythm, signOut } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { AskPartner } from "@/components/AskPartner";

export const dynamic = "force-dynamic";

// Monday-first, the way the week is lived.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function SettingsPage() {
  const supabase = await createClient();
  const [ctx, highlights, rhythm, projects] = await Promise.all([
    supabase.from("profile_context").select("about_me, summary, summary_updated_at").maybeSingle(),
    supabase.from("highlights").select("id, text, source, location").order("created_at", { ascending: false }),
    supabase.from("rhythm").select("id, weekday, title, project_id").order("sort").order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active"),
  ]);

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
        <p className="mt-1 text-sm text-muted">
          Rewritten about once a week from your journal, finished work, skips and eliminations.
          {ctx.data?.summary_updated_at && ` Last updated ${new Date(ctx.data.summary_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`}
        </p>
        {ctx.data?.summary ? (
          <p className="mt-3 max-w-[65ch] font-serif text-lg leading-relaxed whitespace-pre-wrap">{ctx.data.summary}</p>
        ) : (
          <p className="mt-3 text-muted">Nothing yet. It starts once you&rsquo;ve written a few journal entries.</p>
        )}
        <div className="mt-3">
          <AskPartner endpoint="/api/summary" label="Update it now" busyLabel="Reading everything…" className="btn-quiet" />
        </div>
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
          <select name="weekday" aria-label="Day" className="field w-auto">
            {ORDER.map((wd) => <option key={wd} value={wd}>{WEEKDAYS[wd]}</option>)}
          </select>
          <input name="title" required placeholder="Recurring task" aria-label="Recurring task" className="field min-w-0 flex-1" />
          <select name="project_id" aria-label="Project" className="field w-auto">
            <option value="">No project</option>
            {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button className="btn">Add</button>
        </form>
      </section>

      <form action={signOut}>
        <button className="btn-quiet">Sign out</button>
      </form>
    </div>
  );
}
