import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeInstagramCode, syncInstagram } from "@/lib/instagram";

export const maxDuration = 60;

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${origin}/context?tab=settings&instagram=${status}`);
    res.cookies.delete("ig_state");
    return res;
  };

  const jar = await cookies();
  if (searchParams.get("error")) return back("cancelled");
  if (!searchParams.get("state") || searchParams.get("state") !== jar.get("ig_state")?.value) return back("expired");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(`${origin}/login`);

  try {
    const acct = await exchangeInstagramCode(searchParams.get("code")!, origin);
    const { error } = await supabase.from("instagram_accounts").upsert({ user_id: data.user.id, ...acct, connected_at: new Date().toISOString(), synced_at: null });
    if (error) return back("not-set-up");
    after(() => syncInstagram(supabase, { force: true }).catch((e) => console.error("instagram sync", e)));
    return back("connected");
  } catch (e) {
    console.error("Instagram callback", e);
    return back("failed");
  }
}
