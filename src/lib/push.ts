import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

/**
 * Server-only client for the morning job, which runs with no one signed in.
 * Uses SUPABASE_SERVICE_ROLE_KEY. Never import this into anything that runs in the browser.
 */
export function serviceClient(): SupabaseClient {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const pushConfigured = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** The app's own push signing keys, created once and kept where only the server can read them. */
export async function vapidKeys(svc: SupabaseClient) {
  const { data } = await svc.from("push_config").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  const row = { id: 1, public_key: k.publicKey, private_key: k.privateKey };
  const { error } = await svc.from("push_config").insert(row);
  if (error) {
    // Another request created them first.
    const { data: again } = await svc.from("push_config").select("public_key, private_key").eq("id", 1).single();
    return again!;
  }
  return row;
}

export async function sendPush(
  svc: SupabaseClient,
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
) {
  const keys = await vapidKeys(svc);
  webpush.setVapidDetails(`mailto:${process.env.ALLOWED_EMAIL ?? "owner@example.com"}`, keys.public_key, keys.private_key);
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    // The device unsubscribed or the subscription expired: forget it.
    if (code === 404 || code === 410) await svc.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    else console.error("push failed", code, e);
    return false;
  }
}
