import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Chat, type Conversation } from "@/components/Chat";

export const dynamic = "force-dynamic";

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: convParam } = await searchParams;
  const supabase = await createClient();

  // Conversations, newest first. Opens the one asked for, or the latest; "new" starts a fresh one.
  const convs = await supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(100);
  const conversations = (convs.error ? [] : convs.data ?? []) as Conversation[];
  const current = convParam === "new" ? null : conversations.find((c) => c.id === convParam)?.id ?? conversations[0]?.id ?? null;
  const query = supabase.from("messages").select("id, role, content, kind, created_at");
  const { data } = convs.error
    ? await query.order("created_at", { ascending: false }).limit(40)
    : current
      ? await query.eq("conversation_id", current).order("created_at", { ascending: false }).limit(200)
      : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">Partner</h1>
        <Link href="/learned" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">What it&rsquo;s learned</Link>
      </div>
      <Chat key={current ?? "new"} initial={(data ?? []).reverse() as never} conversations={conversations} current={current} threads={!convs.error} />
    </div>
  );
}
