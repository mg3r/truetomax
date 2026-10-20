import { NextResponse } from "next/server";
import { pushConfigured, serviceClient, vapidKeys } from "@/lib/push";

/** The public half of the push keys, which the browser needs to subscribe. */
export async function GET() {
  if (!pushConfigured()) return NextResponse.json({ error: "Add SUPABASE_SERVICE_ROLE_KEY in Vercel first." }, { status: 503 });
  try {
    const { public_key } = await vapidKeys(serviceClient());
    return NextResponse.json({ key: public_key });
  } catch {
    return NextResponse.json({ error: "Run the 0008 setup file in Supabase first." }, { status: 503 });
  }
}
