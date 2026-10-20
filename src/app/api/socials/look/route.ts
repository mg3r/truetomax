import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { lookAtPosts } from "@/lib/instagram";

export const maxDuration = 300;

/** Have the partner look at one post right now (all of it), and say what it learned. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "Which post?" }, { status: 400 });
  const done = await lookAtPosts(supabase, 1, id).catch(() => 0);
  revalidatePath("/socials");
  return done ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Couldn't open that post on Instagram. Try again in a minute." }, { status: 502 });
}
