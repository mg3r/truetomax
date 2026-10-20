import { redirect } from "next/navigation";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  redirect(google ? `/profile?tab=settings&google=${encodeURIComponent(google)}` : "/profile?tab=settings");
}
