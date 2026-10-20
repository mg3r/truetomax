import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only Google Calendar. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel,
 * and https://<your-app>/api/google/callback as an authorized redirect URI in Google Cloud.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/documents.readonly", // read Google Docs you link in Context
  "https://www.googleapis.com/auth/drive.readonly", // read the docs inside Drive folders you link in Context
];
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

export async function accessToken(supabase: SupabaseClient): Promise<string | null> {
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

/** Events for one day across every calendar you have checked in Google Calendar. Null when not connected. */
export async function eventsForDay(supabase: SupabaseClient, day: string): Promise<CalEvent[] | null> {
  const range = await eventsForRange(supabase, day, 1);
  return range ? range[day] ?? [] : null;
}

/** Events for `days` days starting at `start`, keyed by local date. Null when not connected. */
export async function eventsForRange(supabase: SupabaseClient, start: string, days: number): Promise<Record<string, CalEvent[]> | null> {
  if (!googleConfigured()) return null;
  const token = await accessToken(supabase);
  if (!token) return null;
  const headers = { Authorization: `Bearer ${token}` };
  const timeMin = localMidnight(start).toISOString();
  const timeMax = new Date(localMidnight(start).getTime() + days * 86400_000 + 3600_000).toISOString();
  const localDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

  try {
    const list = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader", { headers, signal: AbortSignal.timeout(5000) }).then((r) => r.json());
    const calendars = ((list.items ?? []) as { id: string; summary: string; selected?: boolean; primary?: boolean }[]).filter((c) => c.selected || c.primary);
    const results = await Promise.all(
      calendars.slice(0, 12).map(async (c) => {
        const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250", timeZone: TZ });
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
            day: e.start?.dateTime ? localDate(e.start.dateTime) : e.start?.date ?? start,
            event: {
              id: e.id,
              title: e.summary || "(no title)",
              start: e.start?.dateTime ?? null,
              end: e.end?.dateTime ?? null,
              allDay: !e.start?.dateTime,
              calendar: c.summary,
              link: e.htmlLink,
              location: e.location,
            } as CalEvent,
          }));
      })
    );
    const byDay: Record<string, CalEvent[]> = {};
    for (const { day, event } of results.flat()) (byDay[day] ??= []).push(event);
    for (const k of Object.keys(byDay)) byDay[k].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
    return byDay;
  } catch (e) {
    console.error("Google Calendar fetch failed", e);
    return null;
  }
}

/** Read a Google Doc you've linked, as plain text. */
export async function readGoogleDoc(supabase: SupabaseClient, docId: string): Promise<{ title: string; text: string } | { error: string }> {
  if (!googleConfigured()) return { error: "Connect Google first (Context → Settings)." };
  const token = await accessToken(supabase);
  if (!token) return { error: "Connect Google first (Context → Settings)." };
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (res.status === 403) return { error: "truetomax can't read Google Docs yet. Disconnect and reconnect Google in Settings to grant it." };
  if (!res.ok) return { error: "Couldn't open that doc. Check the link, and that it's in your Google account." };
  const doc = await res.json();
  type El = { paragraph?: { elements?: { textRun?: { content?: string } }[] }; table?: { tableRows?: { tableCells?: { content?: El[] }[] }[] } };
  const walk = (els: El[] = []): string =>
    els
      .map((el) =>
        el.paragraph
          ? (el.paragraph.elements ?? []).map((x) => x.textRun?.content ?? "").join("")
          : el.table
            ? (el.table.tableRows ?? []).map((r) => (r.tableCells ?? []).map((c) => walk(c.content)).join(" | ")).join("\n")
            : ""
      )
      .join("");
  return { title: doc.title ?? "Google Doc", text: walk(doc.body?.content ?? []).replace(/\n{3,}/g, "\n\n").trim() };
}

/** "9:30 AM" in your time zone. */
export function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime: string };
const READABLE = new Set([
  "application/vnd.google-apps.document",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Docs inside a Drive folder (and its subfolders, two levels down), newest first, up to 60. */
export async function listDriveFolder(token: string, folderId: string, depth = 0): Promise<DriveFile[]> {
  const q = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,modifiedTime)",
    pageSize: "200",
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(r.status === 404 ? "Couldn't find that folder. Check the link and that it's in your Drive." : r.status === 403 ? "truetomax can't read Drive yet. Disconnect and reconnect Google in Settings." : "Couldn't open that folder.");
  const files = ((await r.json()).files ?? []) as DriveFile[];
  const docs = files.filter((f) => READABLE.has(f.mimeType));
  if (depth < 2) {
    for (const sub of files.filter((f) => f.mimeType === "application/vnd.google-apps.folder")) {
      docs.push(...(await listDriveFolder(token, sub.id, depth + 1).catch(() => [])));
    }
  }
  return docs.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime)).slice(0, 60);
}

export async function driveFolderName(token: string, folderId: string) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  return r.ok ? ((await r.json()).name as string) : "Drive folder";
}

/** A Drive file's text: Google Docs are exported as plain text; Word files are read with mammoth. */
export async function readDriveFile(token: string, f: DriveFile): Promise<string> {
  const headers = { Authorization: `Bearer ${token}` };
  if (f.mimeType === "application/vnd.google-apps.document") {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`, { headers, signal: AbortSignal.timeout(15000) });
    return r.ok ? r.text() : "";
  }
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, { headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return "";
  if (f.mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await r.arrayBuffer()) });
    return value;
  }
  return r.text();
}
