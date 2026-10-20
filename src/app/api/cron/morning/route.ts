import { NextResponse } from "next/server";
import { prepareDay } from "@/lib/daily";
import { today } from "@/lib/dates";
import { embedMissing } from "@/lib/memory";
import { sendPush, serviceClient } from "@/lib/push";

export const maxDuration = 120;

/**
 * Runs each morning (vercel.json): prepares the day, then sends the affirmation to every subscribed device.
 * Vercel calls it with Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  // Vercel schedules run in UTC, so this runs at 11:30 and 12:30 UTC and only sends at 7 in your time zone.
  // That keeps it at 7:30 local through daylight saving changes.
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "America/New_York" }).format(new Date()));
  if (hour !== 7 && !new URL(req.url).searchParams.has("now")) return NextResponse.json({ skipped: `local hour ${hour}` });

  const svc = serviceClient();
  const { data: subs } = await svc.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
  const users = [...new Set((subs ?? []).map((s) => s.user_id))];
  const day = today();
  let sent = 0;

  for (const userId of users) {
    try {
      await prepareDay(svc, { userId });
    } catch (e) {
      console.error("morning prepare failed", e);
    }
    const { data: d } = await svc.from("days").select("affirmation, focus").eq("user_id", userId).eq("day", day).maybeSingle();
    const body = d?.affirmation ?? "Your day is ready.";
    for (const s of (subs ?? []).filter((x) => x.user_id === userId)) {
      if (await sendPush(svc, s, { title: "Good morning", body, url: "/" })) sent++;
    }
  }

  await embedMissing(svc, 60).catch(() => 0);
  return NextResponse.json({ users: users.length, sent });
}
