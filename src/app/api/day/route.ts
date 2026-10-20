import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareDay } from "@/lib/daily";
import { today } from "@/lib/dates";
import { learnIfDue } from "@/lib/learn";
import { syncInstagram } from "@/lib/instagram";
import { syncDriveFoldersIfStale } from "@/lib/drive";
import { embedMissing } from "@/lib/memory";

export const maxDuration = 120;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { force } = await req.json().catch(() => ({ force: false }));
  await prepareDay(supabase, { force: !!force });
  const { data: d } = await supabase.from("days").select("affirmation").eq("day", today()).maybeSingle();
  // Once a week, after today is served, the partner learns from the week and retunes itself.
  if (d?.affirmation) {
    after(() => learnIfDue(supabase).catch((e) => console.error("learnIfDue", e)));
    after(() => syncInstagram(supabase).catch((e) => console.error("instagram sync", e)));
    after(() => syncDriveFoldersIfStale(supabase).catch((e) => console.error("drive sync", e)));
    after(() => embedMissing(supabase).catch((e) => console.error("embed", e)));
  }
  return NextResponse.json({ ready: !!d?.affirmation });
}
