import { redirect } from "next/navigation";

// Context became Profile (docs and settings); the partner has its own tab.
export default async function OldContextPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { tab, c, ...rest } = await searchParams;
  if (tab === "partner" || (!tab && c)) redirect(c ? `/partner?c=${encodeURIComponent(c)}` : "/partner");
  const params = new URLSearchParams({ tab: tab === "settings" ? "settings" : "context" });
  for (const [k, v] of Object.entries(rest)) if (v) params.set(k, v);
  redirect(`/profile?${params}`);
}
