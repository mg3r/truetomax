import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only Google Calendar. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel,
 * and https://<your-app>/api/google/callback as an authorized redirect URI in Google Cloud.
 */
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.readonly"];
const TZ = process.env.APP_TIMEZONE || "America/New_York";

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export function redirectUri(origin: string) {
  return `${origin}/api/google/callback`;
}

export function authUrl(origin: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || "Google sign-in failed.");
  let email: string | null = null;
  if (json.id_token) {
    try {
      email = JSON.parse(Buffer.from(json.id_token.split(".")[1], "base64url").toString()).email ?? null;
    } catch {}
  }
  return { refresh_token: json.refresh_token as string | undefined, access_token: json.access_token as string, expires_in: json.expires_in as number, email };
}

async function accessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data: acct } = await supabase.from("google_accounts").select("refresh_token, access_token, expires_at").maybeSingle();
  if (!acct) return null;
  if (acct.access_token && acct.expires_at && new Date(acct.expires_at).getTime() > Date.now() + 60_000) return acct.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: acct.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Google token refresh failed", json.error);
    return null;
  }
  await supabase
    .from("google_accounts")
    .update({ access_token: json.access_token, expires_at: new Date(Date.now() + json.expires_in * 1000).toISOString() })
    .not("user_id", "is", null);
  return json.access_token;
}

export type CalEvent = { id: string; title: string; start: string | null; end: string | null; allDay: boolean; calendar: string; link?: string; location?: string };

/** The UTC instant of local midnight at the start of `day` in your time zone. */
function localMidnight(day: string) {
  const guess = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

/** Today's events across every calendar you have checked in Google Calendar. Null when not connected. */
export async function eventsForDay(supabase: SupabaseClient, day: string): Promise<CalEvent[] | null> {
  if (!googleConfigured()) return null;
  const token = await accessToken(supabase);
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const timeMin = localMidnight(day).toISOString();
  const timeMax = new Date(localMidnight(day).getTime() + 86400_000).toISOString();

  try {
    const list = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers, signal: AbortSignal.timeout(5000) }).then((r) => r.json());
    const calendars = ((list.items ?? []) as { id: string; summary: string; selected?: boolean; primary?: boolean }[]).filter((c) => c.selected || c.primary);
    const results = await Promise.all(
      calendars.slice(0, 12).map(async (c) => {
        const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50", timeZone: TZ });
        const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${q}`, { headers, signal: AbortSignal.timeout(5000) });
        if (!r.ok) return [];
        const j = await r.json();
        return ((j.items ?? []) as {
          id: string; summary?: string; status?: string; htmlLink?: string; location?: string;
          start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
          attendees?: { self?: boolean; responseStatus?: string }[];
        }[])
          .filter((e) => e.status !== "cancelled" && !e.attendees?.some((a) => a.self && a.responseStatus === "declined"))
          .map((e) => ({
            id: e.id,
            title: e.summary || "(no title)",
            start: e.start?.dateTime ?? null,
            end: e.end?.dateTime ?? null,
            allDay: !e.start?.dateTime,
            calendar: c.summary,
            link: e.htmlLink,
            location: e.location,
          }));
      })
    );
    return results.flat().sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  } catch (e) {
    console.error("Google Calendar fetch failed", e);
    return null;
  }
}

/** "9:30 AM" in your time zone. */
export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}
