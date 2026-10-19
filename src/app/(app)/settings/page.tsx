import { createClient } from "@/lib/supabase/server";
import { saveAboutMe, addHighlight, deleteHighlight, resetPlan, signOut } from "@/app/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { BookUpload } from "@/components/BookUpload";
import { googleConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

const GOOGLE_STATUS: Record<string, string> = {
  connected: "Connected. Today will show your events from now on.",
  disconnected: "Disconnected. truetomax no longer has access to your calendar.",
  cancelled: "Google sign-in was cancelled. Nothing changed.",
  expired: "That sign-in took too long. Try connecting again.",
  "no-refresh": "Google didn't grant lasting access. Remove truetomax at myaccount.google.com/permissions, then connect again.",
  "not-set-up": "Run the 0004 setup file in Supabase first, then connect again.",
  "not-configured": "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first.",
  failed: "Google sign-in didn't finish. Try again.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google: googleStatus } = await searchParams;
  const supabase = await createClient();
  const [ctx, highlights, bookPages, googleAcct] = await Promise.all([
    supabase.from("profile_context").select("about_me, summary, summary_updated_at").maybeSingle(),
    supabase.from("highlights").select("id, text, source, location").order("created_at", { ascending: false }),
    supabase.from("book_pages").select("book", { count: "exact" }).limit(1),
    supabase.from("google_accounts").select("email").maybeSingle(),
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

      <section aria-labelledby="book-h" id="book" className="scroll-mt-6">
        <h2 id="book-h" className="section-title">Your book</h2>
        <p className="mt-1 text-sm text-muted">
          Add your PDF of The Creative Act. It&rsquo;s read on this device and only its text is stored, privately. Each morning Today opens to a page you haven&rsquo;t seen in a while.
        </p>
        <BookUpload existing={book} />

        <details id="passages" className="mt-6 scroll-mt-6">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">
            Saved passages{highlights.data?.length ? ` (${highlights.data.length})` : ""}
          </summary>
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
        </details>
      </section>

      <section aria-labelledby="calendar-h" id="calendar" className="scroll-mt-6">
        <h2 id="calendar-h" className="section-title">Google Calendar</h2>
        <p className="mt-1 text-sm text-muted">Read-only. Today shows your events alongside your routine and tasks.</p>
        {googleStatus && GOOGLE_STATUS[googleStatus] && <p role="status" className="mt-3 text-sm">{GOOGLE_STATUS[googleStatus]}</p>}
        {!googleConfigured() ? (
          <p className="mt-3 text-sm text-muted">Not set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.</p>
        ) : googleAcct.data ? (
          <form action="/api/google/disconnect" method="post" className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">Connected{googleAcct.data.email ? ` as ${googleAcct.data.email}` : ""}</span>
            <button className="btn-quiet">Disconnect</button>
          </form>
        ) : (
          <a href="/api/google/connect" className="btn mt-3">Connect Google Calendar</a>
        )}
      </section>

      <form action={signOut}>
        <button className="btn-quiet">Sign out</button>
      </form>

      <details className="border-t border-line pt-6">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">Start your plan fresh</summary>
        <p className="mt-2 max-w-[60ch] text-sm text-muted">
          Removes every project, with its goals and tasks. Keeps your visions, routine, journal, moves and everything your partner has learned.
        </p>
        <form action={resetPlan} className="mt-3 flex flex-wrap items-center gap-2">
          <input name="confirm" required pattern="clear" placeholder='Type "clear" to confirm' aria-label='Type "clear" to confirm' className="field w-56" />
          <button className="btn-quiet hover:!border-danger hover:!text-danger">Remove all projects</button>
        </form>
      </details>
    </div>
  );
}
