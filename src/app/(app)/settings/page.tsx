import { redirect } from "next/navigation";

// Setup became the Context tab.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  redirect(google ? `/context?tab=settings&google=${encodeURIComponent(google)}` : "/context?tab=docs");
}
