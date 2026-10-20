import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountStats } from "./instagram";

export type Post = {
  seen?: string | null;
  media_id: string;
  caption: string | null;
  permalink: string | null;
  posted_at: string | null;
  product_type: string | null;
  media_type: string | null;
  thumb_url?: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  interactions?: number | null;
  reposts?: number | null;
  follows?: number | null;
  profile_visits?: number | null;
  avg_watch_ms?: number | null;
  watch_ms?: number | null;
  skip_rate?: number | null;
  duration_s?: number | null;
  seen_detail?: { parts: { label: string; text: string }[]; hook?: string; on_screen_text?: string; watched?: string; takeaway?: string } | null;
};

/** A share of people reached, as a percent (null when there's nothing to divide by). */
export const rateOf = (part: number | null | undefined, of: number | null | undefined) => (part != null && of ? (100 * part) / of : null);

/** Instagram reports skip rate either as 0–1 or as a percent; show it as a percent. */
export const skipPct = (v: number | null | undefined) => (v == null ? null : v <= 1 ? v * 100 : v);

export type SocialRead = {
  summary: string;
  working: string[];
  not_working: string[];
  recommendations: { title: string; why: string; try: string }[];
};

/** One number for how well a post landed: people reached, with saves and shares counting most. */
export const scoreOf = (m: Post) => (m.views ?? m.reach ?? 0) + 5 * ((m.saves ?? 0) + (m.shares ?? 0)) + 2 * (m.comments ?? 0);

export const formatOf = (m: Post) => (m.product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carousel" : m.media_type === "VIDEO" ? "Video" : m.product_type === "STORY" ? "Story" : "Photo");

export async function loadPosts(supabase: SupabaseClient, limit = 100) {
  const full = await supabase.from("instagram_media").select("*").order("posted_at", { ascending: false }).limit(limit);
  return (full.error ? [] : full.data ?? []) as Post[];
}

/** Everything the partner should know about your pages, for sharing ideas and recommendations. */
export async function socialsContext(supabase: SupabaseClient) {
  const full = await supabase.from("instagram_accounts").select("*").maybeSingle();
  const acct = full.data as { username: string; followers: number | null; stats?: AccountStats | null } | null;
  if (full.error || !acct) return "";
  const posts = await loadPosts(supabase);
  const st = acct.stats;
  const account = st
    ? `Last 30 days: ${st.views ?? "?"} views (${st.views_non_followers != null && st.views ? `${Math.round((100 * st.views_non_followers) / st.views)}% from non-followers` : "follower split unknown"}), ${st.reach ?? "?"} accounts reached, ${st.engaged ?? "?"} engaged, ${st.interactions ?? "?"} interactions${st.follows != null ? `, +${st.follows} follows / −${st.unfollows ?? 0} unfollows` : ""}${st.link_taps != null ? `, ${st.link_taps} link taps` : ""}. Views by format: ${Object.entries(st.views_by_format ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "?"}.`
    : "";
  if (!posts.length) return `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers)\nNo posts synced yet.`;

  const pct = (v: number | null) => (v == null ? null : `${v.toFixed(1)}%`);
  const line = (m: Post) => {
    const extra = [
      m.avg_watch_ms != null && `avg watch ${(m.avg_watch_ms / 1000).toFixed(1)}s${m.duration_s ? ` of ${Math.round(m.duration_s)}s` : ""}`,
      skipPct(m.skip_rate) != null && `skip rate ${skipPct(m.skip_rate)!.toFixed(0)}%`,
      m.follows != null && `${m.follows} follows`,
      m.profile_visits != null && `${m.profile_visits} profile visits`,
      m.reposts != null && `${m.reposts} reposts`,
      rateOf(m.shares, m.reach) != null && `share rate ${pct(rateOf(m.shares, m.reach))}`,
      rateOf(m.saves, m.reach) != null && `save rate ${pct(rateOf(m.saves, m.reach))}`,
    ].filter(Boolean);
    const hook = m.seen_detail?.hook ? ` [opens with: ${m.seen_detail.hook}]` : "";
    return `- ${m.posted_at?.slice(0, 10)} ${formatOf(m)}: "${(m.caption ?? "").replace(/\s+/g, " ").slice(0, 140)}"${m.seen ? ` [what's in it: ${m.seen.replace(/\s+/g, " ")}]` : ""}${hook} — ${m.views ?? "?"} views, ${m.reach ?? "?"} reach, ${m.likes ?? 0} likes, ${m.comments ?? 0} comments, ${m.saves ?? 0} saves, ${m.shares ?? 0} shares${extra.length ? `, ${extra.join(", ")}` : ""}`;
  };
  const byFormat = new Map<string, Post[]>();
  for (const p of posts) byFormat.set(formatOf(p), [...(byFormat.get(formatOf(p)) ?? []), p]);
  const avg = (ps: Post[]) => Math.round(ps.reduce((n, p) => n + (p.views ?? p.reach ?? 0), 0) / ps.length);
  const best = [...posts].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 8);
  const latestRead = await supabase.from("social_insights").select("body, created_at").eq("platform", "instagram").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const read = latestRead.error ? null : (latestRead.data?.body as SocialRead | undefined);

  return [
    `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers, ${posts.length} posts synced)`,
    account,
    `By format (average views or reach): ${[...byFormat].map(([f, ps]) => `${f} ×${ps.length} ≈ ${avg(ps)}`).join("; ")}`,
    `Best performing:\n${best.map(line).join("\n")}`,
    `Latest:\n${posts.slice(0, 8).map(line).join("\n")}`,
    read ? `Your last read on his socials: ${read.summary}\nRecommended: ${read.recommendations.map((r) => r.title).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
