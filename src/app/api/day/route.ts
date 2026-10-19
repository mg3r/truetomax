import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareDay } from "@/lib/daily";
import { today } from "@/lib/dates";

export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { force } = await req.json().catch(() => ({ force: false }));
  await prepareDay(supabase, { force: !!force });
  const { data: d } = await supabase.from("days").select("affirmation").eq("day", today()).maybeSingle();
  return NextResponse.json({ ready: !!d?.affirmation });
}
