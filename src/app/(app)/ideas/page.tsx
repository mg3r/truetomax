import { redirect } from "next/navigation";

// Ideas now live where they lead: work-and-income ideas in Projects (Backlog), post ideas on Socials.
export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  redirect(tab === "content" ? "/socials" : "/projects");
}
