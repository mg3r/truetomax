import type { SupabaseClient } from "@supabase/supabase-js";
import { today } from "./dates";

/**
 * Instagram API with Instagram Login (professional accounts, no Facebook Page needed). Read-only.
 * Needs INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel, and
 * https://<your-app>/api/instagram/callback as a valid OAuth redirect URI in the Meta app.
 */
const GRAPH = "https://graph.instagram.com/v25.0";
const SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

export const instagramConfigured = () => !!process.env.INSTAGRAM_APP_ID && !!process.env.INSTAGRAM_APP_SECRET;
const redirectUri = (origin: string) => `${origin}/api/instagram/callback`;

export function instagramAuthUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

/** Code → short-lived token → long-lived token (about 60 days, refreshed automatically). */
export async function exchangeInstagramCode(code: string, origin: string) {
  const short = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
      code: code.replace(/#_$/, ""),
    }),
  }).then((r) => r.json());
  if (!short.access_token) throw new Error(short.error_message || "Instagram sign-in failed.");

  const long = await fetch(
    `https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET!, access_token: short.access_token })}`
  ).then((r) => r.json());
  if (!long.access_token) throw new Error(long.error?.message || "Couldn't get lasting Instagram access.");

  const me = await fetch(`${GRAPH}/me?fields=user_id,username,followers_count&access_token=${long.access_token}`).then((r) => r.json());
  return {
    ig_user_id: String(me.user_id ?? short.user_id),
    username: me.username ?? null,
    followers: me.followers_count ?? null,
    access_token: long.access_token as string,
    expires_at: new Date(Date.now() + (long.expires_in ?? 5_184_000) * 1000).toISOString(),
  };
}

/** Long-lived tokens last ~60 days; refresh when under 10 days remain. */
async function token(supabase: SupabaseClient) {
  const { data: acct } = await supabase.from("instagram_accounts").select("access_token, expires_at, connected_at").maybeSingle();
  if (!acct) return null;
  const left = acct.expires_at ? new Date(acct.expires_at).getTime() - Date.now() : 0;
  if (left < 10 * 86400_000 && Date.now() - new Date(acct.connected_at).getTime() > 86400_000) {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${acct.access_token}`).then((x) => x.json());
    if (r.access_token) {
      await supabase
        .from("instagram_accounts")
        .update({ access_token: r.access_token, expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
        .not("user_id", "is", null);
      return r.access_token as string;
    }
  }
  return acct.access_token as string;
}

type Media = { id: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; thumbnail_url?: string; media_url?: string; timestamp?: string; like_count?: number; comments_count?: number };

async function insights(id: string, access: string) {
  // "views" is still rolling out; if a post rejects it, ask again without it.
  for (const metric of ["reach,saved,shares,views", "reach,saved,shares"]) {
    const r = await fetch(`${GRAPH}/${id}/insights?metric=${metric}&access_token=${access}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) continue;
    const j = await r.json();
    const get = (name: string) => (j.data ?? []).find((m: { name: string }) => m.name === name)?.values?.[0]?.value ?? null;
    return { reach: get("reach"), saves: get("saved"), shares: get("shares"), views: get("views") };
  }
  return { reach: null, saves: null, shares: null, views: null };
}

/**
 * Pull recent posts and their numbers. New posts since you connected are logged as moves (shared),
 * so sharing on Instagram counts toward the number that matters without logging it by hand.
 */
export async function syncInstagram(supabase: SupabaseClient, { force = false } = {}) {
  if (!instagramConfigured()) return;
  const { data: acct, error } = await supabase.from("instagram_accounts").select("synced_at, connected_at").maybeSingle();
  if (error || !acct) return;
  if (!force && acct.synced_at && Date.now() - new Date(acct.synced_at).getTime() < 6 * 3600_000) return;

  const access = await token(supabase);
  if (!access) return;
  const me = await fetch(`${GRAPH}/me?fields=username,followers_count,media_count&access_token=${access}`).then((r) => r.json());
  // Your posts, newest first, up to 100.
  const posts: Media[] = [];
  let next: string | null = `${GRAPH}/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50&access_token=${access}`;
  while (next && posts.length < 100) {
    const page: { data?: Media[]; paging?: { next?: string } } = await fetch(next).then((r) => r.json());
    posts.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }
  const { data: known } = await supabase.from("instagram_media").select("media_id");
  const seen = new Set((known ?? []).map((m) => m.media_id));

  const rows = await Promise.all(
    posts.map(async (m) => ({
      media_id: m.id,
      caption: m.caption ?? null,
      media_type: m.media_type ?? null,
      product_type: m.media_product_type ?? null,
      permalink: m.permalink ?? null,
      posted_at: m.timestamp ?? null,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      thumb_url: m.thumbnail_url ?? (m.media_type !== "VIDEO" ? m.media_url ?? null : null),
      ...(await insights(m.id, access)),
      synced_at: new Date().toISOString(),
    }))
  );
  if (rows.length) {
    const { error: upErr } = await supabase.from("instagram_media").upsert(rows, { onConflict: "user_id,media_id" });
    // Before the socials migration adds the picture column, save without it.
    if (upErr && /thumb_url/.test(upErr.message)) await supabase.from("instagram_media").upsert(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "thumb_url"))), { onConflict: "user_id,media_id" });
  }

  const fresh = rows.filter((r) => !seen.has(r.media_id) && r.posted_at && r.posted_at >= acct.connected_at);
  if (fresh.length) {
    await supabase.from("moves").insert(
      fresh.map((r) => ({
        kind: "shared",
        note: `Posted on Instagram${r.caption ? `: ${r.caption.slice(0, 120)}` : ""}`,
        day: r.posted_at!.slice(0, 10),
      }))
    );
  }

  await supabase
    .from("instagram_accounts")
    .update({ username: me.username ?? undefined, followers: me.followers_count ?? undefined, synced_at: new Date().toISOString() })
    .not("user_id", "is", null);
}

/** A compact read of what's landing, for the partner. */
export async function instagramContext(supabase: SupabaseClient) {
  const { data: acct, error } = await supabase.from("instagram_accounts").select("username, followers").maybeSingle();
  if (error || !acct) return "";
  const { data: media } = await supabase
    .from("instagram_media")
    .select("caption, product_type, posted_at, likes, comments, reach, saves, shares, views")
    .order("posted_at", { ascending: false })
    .limit(20);
  const list = media ?? [];
  if (!list.length) return `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers)\nNo posts synced yet.`;
  const score = (m: (typeof list)[number]) => (m.views ?? m.reach ?? 0) + 5 * ((m.saves ?? 0) + (m.shares ?? 0));
  const best = [...list].sort((a, b) => score(b) - score(a)).slice(0, 3);
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const recent = list.filter((m) => (m.posted_at ?? "") >= since);
  const fmt = (m: (typeof list)[number]) =>
    `- ${m.posted_at?.slice(0, 10)} ${m.product_type ?? ""}: "${(m.caption ?? "").replace(/\s+/g, " ").slice(0, 90)}" — ${m.views ?? "?"} views, ${m.reach ?? "?"} reach, ${m.likes ?? 0} likes, ${m.saves ?? 0} saves, ${m.shares ?? 0} shares`;
  return [
    `## Instagram (@${acct.username}, ${acct.followers ?? "?"} followers)`,
    `${recent.length} posts in the last 30 days (as of ${today()}).`,
    `What landed best recently:\n${best.map(fmt).join("\n")}`,
    `Latest:\n${list.slice(0, 5).map(fmt).join("\n")}`,
  ].join("\n");
}
