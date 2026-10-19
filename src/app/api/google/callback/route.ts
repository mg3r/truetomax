import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/google";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${origin}/context?tab=settings&google=${status}`);
    res.cookies.delete("g_state");
    return res;
  };

  const jar = await cookies();
  if (searchParams.get("error")) return back("cancelled");
  if (!searchParams.get("state") || searchParams.get("state") !== jar.get("g_state")?.value) return back("expired");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${origin}/login`);

  try {
    const t = await exchangeCode(searchParams.get("code")!, origin);
    if (!t.refresh_token) return back("no-refresh");
    const { error } = await supabase.from("google_accounts").upsert({
      user_id: data.user.id,
      email: t.email,
      refresh_token: t.refresh_token,
      access_token: t.access_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    });
    if (error) return back("not-set-up");
    return back("connected");
  } catch (e) {
    console.error("Google callback", e);
    return back("failed");
  }
}
