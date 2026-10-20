import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveAboutMe, addHighlight, deleteHighlight, resetPlan, signOut, deleteContextDoc, refreshGoogleDoc, resyncDriveFolder, removeDriveFolder } from "@/app/actions";
import { DeleteButton, ActionButton } from "@/components/DeleteButton";
import { BookUpload } from "@/components/BookUpload";
import { DocUpload, GoogleDocLink } from "@/components/Docs";
import { Chat } from "@/components/Chat";
import { googleConfigured } from "@/lib/google";
import { instagramConfigured } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "partner", label: "Partner" },
  { id: "docs", label: "Your docs" },
  { id: "settings", label: "Settings" },
] as const;

const GOOGLE_STATUS: Record<string, string> = {
  connected: "Connected. Today shows your events, and you can link Google Docs.",
  disconnected: "Disconnected. truetomax no longer has access to your Google account.",
  cancelled: "Google sign-in was cancelled. Nothing changed.",
  expired: "That sign-in took too long. Try connecting again.",
  "no-refresh": "Google didn't grant lasting access. Remove truetomax at myaccount.google.com/permissions, then connect again.",
  "not-set-up": "Run the setup files in Supabase first, then connect again.",
  "not-configured": "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first.",
  failed: "Google sign-in didn't finish. Try again.",
};

const INSTAGRAM_STATUS: Record<string, string> = {
  connected: "Connected. Your posts and their numbers will show under Ideas → Sharing within a minute.",
  disconnected: "Disconnected. truetomax no longer has access to your Instagram.",
  cancelled: "Instagram sign-in was cancelled. Nothing changed.",
  expired: "That sign-in took too long. Try connecting again.",
  "not-set-up": "Run the 0006 setup file in Supabase first, then connect again.",
  "not-configured": "Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel first.",
  failed: "Instagram sign-in didn't finish. Check the account is a professional account and is added as a tester in the Meta app.",
};

export default async function ContextPage({ searchParams }: { searchParams: Promise<{ tab?: string; google?: string; instagram?: string }> }) {
  const { tab: tabParam, google: googleStatus, instagram: igStatus } = await searchParams;
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam! : googleStatus || igStatus ? "settings" : "partner";
  const supabase = await createClient();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Context</h1>
        <p className="mt-1 max-w-[56ch] text-muted">Everything your partner knows about your life, and where you talk with it.</p>
        <nav className="mt-4 flex gap-1" aria-label="Context">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/context?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm ${tab === t.id ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "partner" && <PartnerTab />}
      {tab === "docs" && <DocsTab />}
      {tab === "settings" && <SettingsTab googleStatus={googleStatus} igStatus={igStatus} />}
    </div>
  );

  async function PartnerTab() {
    const { data } = await supabase.from("messages").select("id, role, content, kind").order("created_at", { ascending: false }).limit(40);
    return (
      <div>
        <Link href="/learned" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">What it&rsquo;s learned about you</Link>
        <div className="mt-6">
          <Chat initial={(data ?? []).reverse() as never} />
        </div>
      </div>
    );
  }

  async function DocsTab() {
    const [ctx, docsRes, highlights, bookPages, googleAcct, foldersRes] = await Promise.all([
      supabase.from("profile_context").select("about_me").maybeSingle(),
      supabase.from("context_docs").select("*").order("updated_at", { ascending: false }),
      supabase.from("highlights").select("id, text, source, location").order("created_at", { ascending: false }),
      supabase.from("book_pages").select("book", { count: "exact" }).limit(1),
      supabase.from("google_accounts").select("email").maybeSingle(),
      supabase.from("drive_folders").select("folder_id, name, synced_at").order("created_at"),
    ]);
    const docs = { error: docsRes.error, data: (docsRes.data ?? []).filter((d) => !d.folder_id) };
    const folders = foldersRes.error ? [] : foldersRes.data ?? [];
    const inFolder = (id: string) => (docsRes.data ?? []).filter((d) => d.folder_id === id).length;
    const book = !bookPages.error && bookPages.count ? { book: bookPages.data?.[0]?.book ?? "Your book", pages: bookPages.count } : null;

    return (
      <div className="space-y-14">
        <section aria-labelledby="docs-h">
          <h2 id="docs-h" className="section-title">your docs</h2>
          <p className="mt-1 max-w-[60ch] text-sm text-muted">Your vision, routine, plans, notes from your coach. Upload files, or link a Google Doc or a whole Drive folder; folders stay in sync each day. Your partner reads all of it when it suggests tasks, asks questions, and plans your day.</p>
          {docs.error ? (
            <p className="mt-3 text-sm text-muted">Run the 0005 setup file in Supabase to turn this on.</p>
          ) : (
            <>
              <div className="mt-4 space-y-4">
                <DocUpload />
                <GoogleDocLink connected={!!googleAcct.data} />
              </div>
              <ul className="mt-6 divide-y divide-line">
                {folders.map((f) => (
                  <li key={f.folder_id} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate">{f.name ?? "Drive folder"}</p>
                      <p className="text-xs text-muted">
                        Drive folder, {inFolder(f.folder_id)} docs{f.synced_at ? `, synced ${new Date(f.synced_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3 text-xs">
                      <ActionButton action={resyncDriveFolder.bind(null, f.folder_id)} className="text-muted hover:text-ink">Refresh</ActionButton>
                      <DeleteButton action={removeDriveFolder.bind(null, f.folder_id)} label="Remove" />
                    </div>
                  </li>
                ))}
                {(docs.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate">{d.title}</p>
                      <p className="text-xs text-muted">
                        {d.source === "gdoc" ? "Google Doc" : "Uploaded"}, {Math.round(d.text.length / 1000) || 1}k characters, updated{" "}
                        {new Date(d.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-3 text-xs">
                      {d.source === "gdoc" && <ActionButton action={refreshGoogleDoc.bind(null, d.id)} className="text-muted hover:text-ink">Refresh</ActionButton>}
                      <DeleteButton action={deleteContextDoc.bind(null, d.id)} label="Remove" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="about">
          <h2 id="about" className="section-title">about you</h2>
          <p className="mt-1 text-sm text-muted">The short version your partner reads first.</p>
          <form action={saveAboutMe} className="mt-3 space-y-2">
            <textarea name="about_me" rows={8} defaultValue={ctx.data?.about_me ?? ""} aria-label="About you" className="field" />
            <button className="btn">Save</button>
          </form>
        </section>

        <section aria-labelledby="book-h" id="book" className="scroll-mt-6">
          <h2 id="book-h" className="section-title">your book</h2>
          <p className="mt-1 text-sm text-muted">Your PDF of The Creative Act. Each morning Today opens to a page you haven&rsquo;t seen in a while.</p>
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
      </div>
    );
  }

  async function SettingsTab({ googleStatus, igStatus }: { googleStatus?: string; igStatus?: string }) {
    const [{ data: googleAcct }, ig] = await Promise.all([
      supabase.from("google_accounts").select("email").maybeSingle(),
      supabase.from("instagram_accounts").select("username, followers").maybeSingle(),
    ]);
    return (
      <div className="space-y-14">
        <section aria-labelledby="calendar-h" id="calendar" className="scroll-mt-6">
          <h2 id="calendar-h" className="section-title">google</h2>
          <p className="mt-1 text-sm text-muted">Read-only: your calendar on Today and Schedule, and the Google Docs and Drive folders you link under Your docs.</p>
          {googleStatus && GOOGLE_STATUS[googleStatus] && <p role="status" className="mt-3 text-sm">{GOOGLE_STATUS[googleStatus]}</p>}
          {!googleConfigured() ? (
            <p className="mt-3 text-sm text-muted">Not set up yet: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.</p>
          ) : googleAcct ? (
            <form action="/api/google/disconnect" method="post" className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm">Connected{googleAcct.email ? ` as ${googleAcct.email}` : ""}</span>
              <button className="btn-quiet">Disconnect</button>
            </form>
          ) : (
            <a href="/api/google/connect" className="btn mt-3">Connect Google</a>
          )}
        </section>

        <section aria-labelledby="ig-h">
          <h2 id="ig-h" className="section-title">instagram</h2>
          <p className="mt-1 text-sm text-muted">Read-only: your posts and how they do. New posts count as moves automatically, and your partner learns what lands.</p>
          {igStatus && INSTAGRAM_STATUS[igStatus] && <p role="status" className="mt-3 text-sm">{INSTAGRAM_STATUS[igStatus]}</p>}
          {!instagramConfigured() ? (
            <p className="mt-3 text-sm text-muted">Not set up yet: add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel.</p>
          ) : ig.data ? (
            <form action="/api/instagram/disconnect" method="post" className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm">Connected as @{ig.data.username}{ig.data.followers != null ? `, ${ig.data.followers.toLocaleString()} followers` : ""}</span>
              <button className="btn-quiet">Disconnect</button>
            </form>
          ) : (
            <a href="/api/instagram/connect" className="btn mt-3">Connect Instagram</a>
          )}
        </section>

        <form action={signOut}>
          <button className="btn-quiet">Sign out</button>
        </form>

        <details className="border-t border-line pt-6">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink">Start fresh</summary>
          <p className="mt-2 max-w-[60ch] text-sm text-muted">
            Clears every vision and project, with their goals and tasks. Keeps your schedule, journal, docs, moves and everything your partner has learned.
          </p>
          <form action={resetPlan} className="mt-3 flex flex-wrap items-center gap-2">
            <input name="confirm" required pattern="clear" placeholder='Type "clear" to confirm' aria-label='Type "clear" to confirm' className="field w-56" />
            <button className="btn-quiet hover:!border-danger hover:!text-danger">Clear visions and projects</button>
          </form>
        </details>
      </div>
    );
  }
}
