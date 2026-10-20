import type { SupabaseClient } from "@supabase/supabase-js";

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
};

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
  const { data: acct, error } = await supabase.from("instagram_accounts").select("username, followers").maybeSingle();
  if (error || !acct) return "";
  const posts = await loadPosts(supabase);
  if (!posts.length) return `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers)\nNo posts synced yet.`;

  const line = (m: Post) =>
    `- ${m.posted_at?.slice(0, 10)} ${formatOf(m)}: "${(m.caption ?? "").replace(/\s+/g, " ").slice(0, 140)}"${m.seen ? ` [what's in it: ${m.seen.replace(/\s+/g, " ")}]` : ""} — ${m.views ?? "?"} views, ${m.reach ?? "?"} reach, ${m.likes ?? 0} likes, ${m.comments ?? 0} comments, ${m.saves ?? 0} saves, ${m.shares ?? 0} shares`;
  const byFormat = new Map<string, Post[]>();
  for (const p of posts) byFormat.set(formatOf(p), [...(byFormat.get(formatOf(p)) ?? []), p]);
  const avg = (ps: Post[]) => Math.round(ps.reduce((n, p) => n + (p.views ?? p.reach ?? 0), 0) / ps.length);
  const best = [...posts].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 8);
  const latestRead = await supabase.from("social_insights").select("body, created_at").eq("platform", "instagram").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const read = latestRead.error ? null : (latestRead.data?.body as SocialRead | undefined);

  return [
    `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers, ${posts.length} posts synced)`,
    `By format (average views or reach): ${[...byFormat].map(([f, ps]) => `${f} ×${ps.length} ≈ ${avg(ps)}`).join("; ")}`,
    `Best performing:\n${best.map(line).join("\n")}`,
    `Latest:\n${posts.slice(0, 8).map(line).join("\n")}`,
    read ? `Your last read on his socials: ${read.summary}\nRecommended: ${read.recommendations.map((r) => r.title).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
