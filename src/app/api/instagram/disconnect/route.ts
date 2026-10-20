import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  await supabase.from("instagram_accounts").delete().not("user_id", "is", null);
  await supabase.from("instagram_media").delete().not("media_id", "is", null);
  return NextResponse.redirect(`${origin}/context?tab=settings&instagram=disconnected`, { status: 303 });
}
