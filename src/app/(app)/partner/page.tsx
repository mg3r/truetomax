import { createClient } from "@/lib/supabase/server";
import { Chat } from "@/components/Chat";

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select("id, role, content, kind").order("created_at", { ascending: false }).limit(40);

  return (
    <div>
      <h1 className="font-serif text-3xl">Partner</h1>
      <p className="mt-1 mb-8 text-muted">It knows your visions, projects, rhythm, journal, and what you&rsquo;ve done and skipped.</p>
      <Chat initial={(data ?? []).reverse() as never} />
    </div>
  );
}
