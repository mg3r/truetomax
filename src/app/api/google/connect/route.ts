import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authUrl, googleConfigured } from "@/lib/google";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/context?tab=settings&google=not-configured`);

  // A random value Google sends back, so the callback knows this request started here.
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
