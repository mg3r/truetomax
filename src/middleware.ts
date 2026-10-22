import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth", "/privacy", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icons", "/offline"];

// The public site (your portfolio) answers on truetomax.com; the private app keeps its own address.
const SITE_HOSTS = (process.env.SITE_HOSTS ?? "truetomax.com,www.truetomax.com").split(",").map((h) => h.trim().toLowerCase());

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const path0 = request.nextUrl.pathname;
  // On the public domain, every page is the site: "/" is the home, "/pottery" the pottery page. No sign-in, ever.
  if (SITE_HOSTS.includes(host)) {
    if (path0.startsWith("/site")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/site${path0 === "/" ? "" : path0}`;
    return NextResponse.rewrite(url);
  }
  // The site's pages can also be previewed from the app's own address, without signing in.
  if (path0.startsWith("/site")) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // This is a one-person app. Anyone else who signs in is signed straight back out.
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  if (data.user && allowed && data.user.email?.toLowerCase() !== allowed && !isPublic) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "This app belongs to someone else.");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|webp)$).*)"],
};
