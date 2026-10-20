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

type Stats = {
  reach: number | null; saves: number | null; shares: number | null; views: number | null;
  interactions?: number | null; reposts?: number | null; follows?: number | null; profile_visits?: number | null;
  avg_watch_ms?: number | null; watch_ms?: number | null; skip_rate?: number | null;
};

/**
 * A post's numbers, as many as Instagram gives for its format. Reels: watch time and skip rate.
 * Photos and carousels: follows and profile visits from the post. Some metrics are still rolling out,
 * so if Instagram refuses the full set, ask again with less.
 */
async function insights(id: string, access: string, reel: boolean): Promise<Stats> {
  const sets = reel
    ? ["views,reach,saved,shares,total_interactions,reposts,ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate", "views,reach,saved,shares,total_interactions,ig_reels_avg_watch_time", "reach,saved,shares,views", "reach,saved,shares"]
    : ["views,reach,saved,shares,total_interactions,reposts,follows,profile_visits", "views,reach,saved,shares,total_interactions", "reach,saved,shares,views", "reach,saved,shares"];
  for (const metric of sets) {
    const r = await fetch(`${GRAPH}/${id}/insights?metric=${metric}&access_token=${access}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (!r?.ok) continue;
    const j = await r.json();
    const get = (name: string) => {
      const v = (j.data ?? []).find((m: { name: string }) => m.name === name)?.values?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    return {
      reach: get("reach"),
      saves: get("saved"),
      shares: get("shares"),
      views: get("views"),
      interactions: get("total_interactions"),
      reposts: get("reposts"),
      follows: get("follows"),
      profile_visits: get("profile_visits"),
      avg_watch_ms: get("ig_reels_avg_watch_time"),
      watch_ms: get("ig_reels_video_view_total_time"),
      skip_rate: get("reels_skip_rate"),
    };
  }
  return { reach: null, saves: null, shares: null, views: null };
}

export type AccountStats = {
  since: string;
  views: number | null;
  reach: number | null;
  engaged: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  reposts: number | null;
  link_taps: number | null;
  views_followers: number | null;
  views_non_followers: number | null;
  reach_followers: number | null;
  reach_non_followers: number | null;
  views_by_format: Record<string, number>;
  follows: number | null;
  unfollows: number | null;
};

/** Your account over the last 30 days, the way Instagram's own insights break it down. */
async function accountStats(access: string): Promise<AccountStats> {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 86400 + 60;
  const base = `${GRAPH}/me/insights?period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${access}`;
  type Row = { name: string; total_value?: { value?: number; breakdowns?: { results?: { dimension_values: string[]; value: number }[] }[] } };
  const call = async (q: string): Promise<Row[]> => {
    const r = await fetch(`${base}&${q}`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!r?.ok) return [];
    return ((await r.json()).data ?? []) as Row[];
  };
  const one = async (metric: string) => (await call(`metric=${metric}`))[0]?.total_value?.value ?? null;
  const split = async (metric: string, by: string) => {
    const out: Record<string, number> = {};
    for (const res of (await call(`metric=${metric}&breakdown=${by}`))[0]?.total_value?.breakdowns?.[0]?.results ?? []) out[res.dimension_values[0]] = res.value;
    return out;
  };
  const totals = await call("metric=views,reach,accounts_engaged,total_interactions,likes,comments,saves,shares,reposts,profile_links_taps");
  const t = (name: string) => totals.find((x) => x.name === name)?.total_value?.value ?? null;
  const [viewsBy, reachBy, format, follows] = await Promise.all([
    split("views", "follow_type").then(async (o) => (Object.keys(o).length ? o : split("views", "follower_type"))),
    split("reach", "follow_type"),
    split("views", "media_product_type"),
    split("follows_and_unfollows", "follow_type"),
  ]);
  return {
    since: new Date(since * 1000).toISOString(),
    views: t("views") ?? (await one("views")),
    reach: t("reach"),
    engaged: t("accounts_engaged"),
    interactions: t("total_interactions"),
    likes: t("likes"),
    comments: t("comments"),
    saves: t("saves"),
    shares: t("shares"),
    reposts: t("reposts"),
    link_taps: t("profile_links_taps"),
    views_followers: viewsBy.FOLLOWER ?? null,
    views_non_followers: viewsBy.NON_FOLLOWER ?? null,
    reach_followers: reachBy.FOLLOWER ?? null,
    reach_non_followers: reachBy.NON_FOLLOWER ?? null,
    views_by_format: format,
    follows: follows.FOLLOWER ?? null,
    unfollows: follows.NON_FOLLOWER ?? null,
  };
}

const NEW_COLUMNS = ["interactions", "reposts", "follows", "profile_visits", "avg_watch_ms", "watch_ms", "skip_rate"];

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
      ...(await insights(m.id, access, m.media_product_type === "REELS")),
      synced_at: new Date().toISOString(),
    }))
  );
  if (rows.length) {
    const without = (cols: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !cols.includes(k))));
    let { error: upErr } = await supabase.from("instagram_media").upsert(rows, { onConflict: "user_id,media_id" });
    // Before the newer migrations add their columns, save what fits.
    if (upErr) ({ error: upErr } = await supabase.from("instagram_media").upsert(without(NEW_COLUMNS), { onConflict: "user_id,media_id" }));
    if (upErr) await supabase.from("instagram_media").upsert(without([...NEW_COLUMNS, "thumb_url"]), { onConflict: "user_id,media_id" });
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

  const basics = { username: me.username ?? undefined, followers: me.followers_count ?? undefined, synced_at: new Date().toISOString() };
  const stats = await accountStats(access).catch(() => null);
  const { error: statErr } = await supabase.from("instagram_accounts").update({ ...basics, ...(stats ? { stats } : {}) }).not("user_id", "is", null);
  if (statErr) await supabase.from("instagram_accounts").update(basics).not("user_id", "is", null);
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

/** Fetch an image and return it ready for the partner to look at (skips anything too big or not an image). */
async function grab(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_500_000) return null;
    return { mediaType: type, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

export type SeenDetail = {
  parts: { label: string; text: string }[];
  hook?: string;
  on_screen_text?: string;
  watched?: string;
};

type Child = { media_type?: string; media_url?: string; thumbnail_url?: string };

/**
 * Your partner looks at each post once, all of it: every photo, every slide of a carousel, and frames from across
 * each video (a reel, or a video inside a carousel). It keeps a short summary for the list, and the full read,
 * slide by slide or moment by moment, for when you open it. Sound isn't heard; on-screen text is read.
 */
export async function lookAtPosts(supabase: SupabaseClient, limit = 8) {
  if (!instagramConfigured()) return 0;
  const { data: rows, error } = await supabase
    .from("instagram_media")
    .select("media_id, caption, media_type, product_type")
    .is("seen", null)
    .order("posted_at", { ascending: false })
    .limit(limit);
  if (error || !rows?.length) return 0;
  const access = await token(supabase);
  if (!access) return 0;
  const { askAboutSequence } = await import("./ai");
  const { framesOf } = await import("./video");

  const lookAt = async (m: (typeof rows)[number]) => {
    const info = await fetch(`${GRAPH}/${m.media_id}?fields=media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}&access_token=${access}`, {
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());
    const items: Child[] = info.children?.data?.length ? info.children.data : [info];
    const carousel = items.length > 1;
    const parts: ({ text: string } | { mediaType: string; data: string })[] = [];
    let duration: number | null = null;
    let budget = 26_000_000; // keep the whole look comfortably under the request size limit
    let pictures = 0;
    const add = (img: { mediaType: string; data: string }) => {
      if (pictures >= 60 || img.data.length > budget) return false;
      budget -= img.data.length;
      pictures++;
      parts.push(img);
      return true;
    };

    for (const [i, c] of items.entries()) {
      const label = carousel ? `Slide ${i + 1} of ${items.length}` : "";
      if (c.media_type === "VIDEO" && c.media_url) {
        const v = await framesOf(c.media_url, { max: carousel ? 8 : 16 });
        if (!carousel) duration = v.duration;
        if (v.frames.length) {
          parts.push({ text: `${label ? `${label}: ` : ""}a video${v.duration ? ` (${Math.round(v.duration)}s)` : ""}. Frames from across it, in order:` });
          for (const f of v.frames) {
            parts.push({ text: `${f.at.toFixed(1)}s` });
            if (!add(f)) break;
          }
          continue;
        }
        // Couldn't open the video: fall back to its cover.
        const cover = c.thumbnail_url ? await grab(c.thumbnail_url) : null;
        if (cover) {
          parts.push({ text: `${label ? `${label}: ` : ""}a video (only its cover could be seen):` });
          add(cover);
        }
        continue;
      }
      const img = await grab(c.media_url ?? c.thumbnail_url ?? "");
      if (img) {
        if (label) parts.push({ text: `${label}: a photo` });
        add(img);
      }
    }
    if (!pictures) {
      await supabase.from("instagram_media").update({ seen: "", seen_at: new Date().toISOString() }).eq("media_id", m.media_id);
      return false;
    }

    const kind = carousel ? `a carousel of ${items.length} slides` : info.media_type === "VIDEO" || m.product_type === "REELS" ? "a reel" : "a photo";
    const reply = await askAboutSequence({
      parts,
      maxTokens: 2500,
      prompt: `That is one of Max's Instagram posts: ${kind}, all of it.
Caption: "${(m.caption ?? "").slice(0, 800)}"
Describe what's actually there. No praise, no advice. Sound isn't available, so don't guess at audio; read any on-screen text exactly.
Return only JSON:
{"summary": "2–3 plain sentences: the subject (food, pottery, music, people, place), whether Max is in it, the setting and light, the style (close-up, process, finished piece, candid, polished)",
 "hook": "what the very first frame or slide shows, the moment someone decides to stay or scroll",
 "parts": [${carousel ? `{"label": "Slide 1", "text": "what this slide shows, in a sentence or two"}, one per slide` : kind === "a reel" ? `{"label": "0–4s", "text": "what happens in this stretch"}, covering the whole video in order` : `{"label": "Photo", "text": "what's in it"}`}],
 "on_screen_text": "every bit of text shown on screen, in order (empty if none)"}`,
    });
    const s0 = reply.indexOf("{");
    const e0 = reply.lastIndexOf("}");
    let parsed: { summary?: string; hook?: string; parts?: SeenDetail["parts"]; on_screen_text?: string } = {};
    try {
      parsed = JSON.parse(reply.slice(s0, e0 + 1));
    } catch {
      parsed = { summary: reply.slice(0, 800) };
    }
    const detail: SeenDetail = {
      parts: (parsed.parts ?? []).filter((x) => x?.text).slice(0, 30),
      hook: parsed.hook || undefined,
      on_screen_text: parsed.on_screen_text || undefined,
      watched: carousel ? `All ${items.length} slides` : kind === "a reel" ? (duration ? `Frames from across all ${Math.round(duration)}s (no sound)` : "Frames from across the video (no sound)") : undefined,
    };
    const seen = (parsed.summary ?? "").slice(0, 900);
    const now = new Date().toISOString();
    const { error: upErr } = await supabase.from("instagram_media").update({ seen, seen_detail: detail, duration_s: duration, seen_at: now }).eq("media_id", m.media_id);
    // Before 0023 runs, keep just the summary.
    if (upErr) await supabase.from("instagram_media").update({ seen, seen_at: now }).eq("media_id", m.media_id);
    return true;
  };

  // A few at a time: videos take a little while to download and skim.
  let done = 0;
  for (let k = 0; k < rows.length; k += 3) {
    const batch = await Promise.all(
      rows.slice(k, k + 3).map((m) =>
        lookAt(m).catch((e) => {
          console.error("lookAtPosts", e);
          return false;
        })
      )
    );
    done += batch.filter(Boolean).length;
  }
  return done;
}
