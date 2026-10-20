import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Chat, type Conversation } from "@/components/Chat";
import { Learned } from "./Learned";

export const dynamic = "force-dynamic";

export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ c?: string; view?: string }> }) {
  const { c: convParam, view } = await searchParams;
  const supabase = await createClient();
  const learned = view === "learned";

  // A dot on Learned when something is waiting for your answer.
  const [hunches, proposals, unseen] = await Promise.all([
    supabase.from("insights").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("rhythm_proposals").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("seen", false),
  ]);
  const waiting = (hunches.count ?? 0) + (proposals.count ?? 0) + (unseen.count ?? 0) > 0;
  const tabs = (
    <nav className="flex gap-1" aria-label="Partner">
      {[
        { id: "chat", label: "Chat", href: "/partner" },
        { id: "learned", label: "Learned", href: "/partner?view=learned" },
      ].map((t) => {
        const on = (t.id === "learned") === learned;
        return (
          <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined} className={`relative rounded-full px-3 py-1 text-sm ${on ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
            {t.label}
            {t.id === "learned" && waiting && !on && <span aria-label="something to answer" className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-ink" />}
          </Link>
        );
      })}
    </nav>
  );

  if (learned)
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-3xl">Partner</h1>
          <div className="mt-4">{tabs}</div>
        </div>
        <Learned />
      </div>
    );

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
      <div>
        <h1 className="font-serif text-3xl">Partner</h1>
        <div className="mt-4">{tabs}</div>
      </div>
      <Chat key={current ?? "new"} initial={(data ?? []).reverse() as never} conversations={conversations} current={current} threads={!convs.error} />
    </div>
  );
}
