import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshSummaryIfStale } from "@/lib/daily";

export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await refreshSummaryIfStale(supabase, true);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
