import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { learn } from "@/lib/learn";

export const maxDuration = 120;

/** Run the learning pass now instead of waiting for the week to turn. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await learn(supabase);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The learning pass didn't finish." }, { status: 502 });
  }
}
