import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { instagramAuthUrl, instagramConfigured } from "@/lib/instagram";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${origin}/login`);
  if (!instagramConfigured()) return NextResponse.redirect(`${origin}/profile?tab=settings&instagram=not-configured`);

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(instagramAuthUrl(origin, state));
  res.cookies.set("ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
