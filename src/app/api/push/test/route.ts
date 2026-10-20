import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPush, serviceClient } from "@/lib/push";

/** Send a test notification to this account's devices. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  const svc = serviceClient();
  let sent = 0;
  for (const s of subs ?? []) if (await sendPush(svc, s, { title: "truetomax", body: "This is how your mornings will start.", url: "/" })) sent++;
  return NextResponse.json({ sent });
}
