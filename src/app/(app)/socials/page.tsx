import Link from "next/link";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncInstagram, lookAtPosts } from "@/lib/instagram";
import { loadPosts, scoreOf, formatOf, rateOf, skipPct, type Post, type SocialRead } from "@/lib/socials";
import { AskPartner } from "@/components/AskPartner";
import { PostRow } from "@/components/PostRow";
import type { AccountStats } from "@/lib/instagram";
import { IdeaList } from "@/components/IdeaList";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const acctRes = await supabase.from("instagram_accounts").select("*").maybeSingle();
  const acct = acctRes.data as { username: string; followers: number | null; synced_at: string | null; stats?: AccountStats | null } | null;
  const acctErr = acctRes.error;
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

  // Instagram's own account totals when it gives them; otherwise added up from your posts.
  const st = acct.stats ?? null;
  const pct = (v: number | null) => (v == null ? "–" : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
  const stats: [string, string | number][] = [
    ["Followers", n(acct.followers)],
    ["Posts", month.length],
    ["Views", n(st?.views ?? sum(month, "views"))],
    ["Reach", n(st?.reach ?? sum(month, "reach"))],
    ...(st?.views_non_followers != null && st.views ? ([["From non-followers", pct((100 * st.views_non_followers) / st.views)]] as [string, string][]) : []),
    ...(st?.engaged != null ? ([["Accounts engaged", n(st.engaged)]] as [string, string][]) : []),
    ["Interactions", n(st?.interactions ?? sum(month, "likes") + sum(month, "comments") + sum(month, "saves") + sum(month, "shares"))],
    ["Saves", n(st?.saves ?? sum(month, "saves"))],
    ["Shares", n(st?.shares ?? sum(month, "shares"))],
    ...(st?.follows != null ? ([["Follows", `+${n(st.follows)}${st.unfollows ? ` / −${n(st.unfollows)}` : ""}`]] as [string, string][]) : []),
    ...(st?.link_taps != null ? ([["Link taps", n(st.link_taps)]] as [string, string][]) : []),
  ];

  // How each format does, side by side.
  const avg = (vals: (number | null)[]) => {
    const xs = vals.filter((v): v is number => v != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const byFormat = new Map<string, Post[]>();
  for (const p of posts) byFormat.set(formatOf(p), [...(byFormat.get(formatOf(p)) ?? []), p]);
  const formats = [...byFormat].map(([name, ps]) => ({
    name,
    count: ps.length,
    views: Math.round(avg(ps.map((p) => p.views ?? p.reach)) ?? 0),
    share: avg(ps.map((p) => rateOf(p.shares, p.reach))) != null ? pct(avg(ps.map((p) => rateOf(p.shares, p.reach)))) : null,
    save: avg(ps.map((p) => rateOf(p.saves, p.reach))) != null ? pct(avg(ps.map((p) => rateOf(p.saves, p.reach)))) : null,
    watch: avg(ps.map((p) => p.avg_watch_ms ?? null)) != null ? `${(avg(ps.map((p) => p.avg_watch_ms ?? null))! / 1000).toFixed(1)}s` : null,
    skip: avg(ps.map((p) => skipPct(p.skip_rate))) != null ? pct(avg(ps.map((p) => skipPct(p.skip_rate)))) : null,
  }));

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
        <dl className="mt-4 grid grid-cols-3 gap-y-5 sm:grid-cols-5">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-serif text-3xl font-light tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">Everything here except followers is for the last 30 days.</p>

        {formats.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-1.5 font-normal">By format</th>
                  <th className="pb-1.5 font-normal">Posts</th>
                  <th className="pb-1.5 font-normal">Avg views</th>
                  <th className="pb-1.5 font-normal">Share rate</th>
                  <th className="pb-1.5 font-normal">Save rate</th>
                  <th className="pb-1.5 font-normal">Avg watch</th>
                  <th className="pb-1.5 font-normal">Skip rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {formats.map((f) => (
                  <tr key={f.name}>
                    <td className="py-1.5">{f.name}</td>
                    <td>{f.count}</td>
                    <td>{n(f.views)}</td>
                    <td>{f.share ?? "–"}</td>
                    <td>{f.save ?? "–"}</td>
                    <td>{f.watch ?? "–"}</td>
                    <td>{f.skip ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1.5 text-xs text-muted">Share and save rates are out of the people each post reached; averages are over every synced post.</p>
          </div>
        )}
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
              <PostRow key={m.media_id} m={m} best={top?.media_id === m.media_id} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No posts synced yet. They&rsquo;ll appear within a few minutes.</p>
        )}
      </section>
    </div>
  );
}
