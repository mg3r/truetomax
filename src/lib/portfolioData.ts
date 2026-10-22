import { createClient } from "@supabase/supabase-js";
import type { PortfolioItem } from "./portfolio";

/** The public site reads with the public key: it only ever sees what you've published. */
function publicClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
}

export async function publishedItems(section?: string): Promise<PortfolioItem[]> {
  let q = publicClient().from("portfolio_items").select("id, section, image_path, title, description, width, height, sort, published").eq("published", true);
  if (section) q = q.eq("section", section);
  const { data, error } = await q.order("sort").order("created_at");
  return error ? [] : ((data ?? []) as PortfolioItem[]);
}

/** "" on truetomax.com, "/site" when previewing from the app's own address, so links work in both. */
export async function siteBase() {
  const { headers } = await import("next/headers");
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const hosts = (process.env.SITE_HOSTS ?? "truetomax.com,www.truetomax.com").split(",").map((h) => h.trim().toLowerCase());
  return hosts.includes(host) ? "" : "/site";
}
