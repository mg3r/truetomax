import Link from "next/link";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncInstagram, lookAtPosts } from "@/lib/instagram";
import { loadPosts, scoreOf, formatOf, type Post, type SocialRead } from "@/lib/socials";
import { AskPartner } from "@/components/AskPartner";
import { Thumb } from "@/components/Thumb";
import { IdeaList } from "@/components/IdeaList";

export const dynamic = "force-dynamic";

const n = (v: number | null | undefined) => (v == null ? "–" : v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : v.toLocaleString());
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "");

export default async function SocialsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const best = sort === "best";
  const supabase = await createClient();
  // Refresh from Instagram in the background (at most every few hours); this view shows what's saved.
  after(async () => {
    await syncInstagram(supabase).catch(() => {});
    await lookAtPosts(supabase, 6).catch(() => 0);
  });

  const { data: acct, error: acctErr } = await supabase.from("instagram_accounts").select("username, followers, synced_at").maybeSingle();
  if (acctErr || !acct)
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-3xl">Socials</h1>
        <p className="text-muted">
          <Link href="/profile?tab=settings" className="text-ink underline decoration-line underline-offset-4">Connect Instagram</Link> to see your posts, how they do, and what to try next.
        </p>
      </div>
    );

  const [posts, ideaRows, readRow] = await Promise.all([
    loadPosts(supabase),
    supabase.from("ideas").select("id, title, body, first_step, money_path").eq("kind", "content").in("status", ["new", "exploring"]).order("created_at", { ascending: false }),
    supabase.from("social_insights").select("body, created_at").eq("platform", "instagram").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const read = readRow.error ? null : (readRow.data?.body as SocialRead | undefined) ?? null;

  const since = Date.now() - 30 * 86400_000;
  const month = posts.filter((p) => p.posted_at && new Date(p.posted_at).getTime() >= since);
  const sum = (ps: Post[], k: keyof Post) => ps.reduce((t, p) => t + (Number(p[k]) || 0), 0);
  const top = posts.length ? posts.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a)) : null;
  const list = best ? [...posts].sort((a, b) => scoreOf(b) - scoreOf(a)) : posts;

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Socials</h1>
        <nav className="mt-4 flex gap-1" aria-label="Platforms">
          <span aria-current="page" className="rounded-full bg-ink px-3 py-1 text-sm text-bg">Instagram</span>
        </nav>
      </div>

      <section aria-labelledby="account">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="account" className="section-title">@{acct.username}</h2>
          {acct.synced_at && <span className="text-xs text-muted">updated {shortDate(acct.synced_at)}</span>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-y-5 sm:grid-cols-6">
          {[
            ["Followers", n(acct.followers)],
            ["Posts, 30 days", month.length],
            ["Views", n(sum(month, "views"))],
            ["Reach", n(sum(month, "reach"))],
            ["Saves", n(sum(month, "saves"))],
            ["Shares", n(sum(month, "shares"))],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-col-reverse">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-serif text-3xl font-light tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">Views, reach, saves and shares are for posts from the last 30 days.</p>
      </section>

      <section aria-labelledby="recs" className="pebble bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="recs" className="section-title">what to do next</h2>
          {readRow.data?.created_at && <span className="text-xs text-muted">from {shortDate(readRow.data.created_at)}</span>}
        </div>
        {read ? (
          <div className="mt-3 space-y-5">
            <p className="max-w-[62ch] font-serif text-lg leading-relaxed">{read.summary}</p>
            {(read.working.length > 0 || read.not_working.length > 0) && (
              <div className="grid gap-5 sm:grid-cols-2">
                {read.working.length > 0 && (
                  <div>
                    <h3 className="text-xs text-muted">Working</h3>
                    <ul className="mt-1 space-y-1.5">{read.working.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}
                {read.not_working.length > 0 && (
                  <div>
                    <h3 className="text-xs text-muted">Not landing</h3>
                    <ul className="mt-1 space-y-1.5">{read.not_working.map((w, i) => <li key={i}>{w}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            <ol className="space-y-4">
              {read.recommendations.map((r, i) => (
                <li key={i} className="border-t border-line pt-4">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted">{r.why}</p>
                  <p className="mt-1.5 text-sm"><span className="text-muted">This week: </span>{r.try}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-2 text-muted">Your partner hasn&rsquo;t read your posts yet.</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <AskPartner endpoint="/api/socials" label={read ? "Read my posts again" : "Read my posts"} busyLabel="Reading your posts…" className="btn-quiet" />

        </div>
      </section>

      <IdeaList kind="content" ideas={ideaRows.data ?? []} />

      <section aria-labelledby="posts">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="posts" className="section-title">posts</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/socials" className={!best ? "text-ink underline decoration-line underline-offset-4" : "text-muted hover:text-ink"}>Latest</Link>
            <Link href="/socials?sort=best" className={best ? "text-ink underline decoration-line underline-offset-4" : "text-muted hover:text-ink"}>Best</Link>
          </div>
        </div>
        {list.length ? (
          <ul className="mt-3 divide-y divide-line">
            {list.map((m) => (
              <li key={m.media_id}>
                <a href={m.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="group flex gap-4 py-4">
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-md">
                    <Thumb src={m.thumb_url} alt="" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      {shortDate(m.posted_at)} · {formatOf(m)}
                      {top?.media_id === m.media_id && <span className="ml-2 text-ink">best so far</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">{m.caption?.trim() || "(no caption)"}</p>
                    {m.seen && <p className="mt-1 line-clamp-2 text-xs text-muted italic">{m.seen}</p>}
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
                      {m.views != null && <span>{n(m.views)} views</span>}
                      <span>{n(m.reach)} reach</span>
                      <span>{n(m.likes)} likes</span>
                      <span>{n(m.comments)} comments</span>
                      <span>{n(m.saves)} saves</span>
                      <span>{n(m.shares)} shares</span>
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No posts synced yet. They&rsquo;ll appear within a few minutes.</p>
        )}
      </section>
    </div>
  );
}
