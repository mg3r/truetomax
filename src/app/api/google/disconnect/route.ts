import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: acct } = await supabase.from("google_accounts").select("refresh_token").maybeSingle();
  if (acct?.refresh_token) {
    // Revoke at Google too, so the access is really gone.
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(acct.refresh_token)}`, { method: "POST" }).catch(() => {});
  }
  await supabase.from("google_accounts").delete().not("user_id", "is", null);
  return NextResponse.redirect(`${origin}/profile?tab=settings&google=disconnected`, { status: 303 });
}
