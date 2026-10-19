import { createClient } from "@/lib/supabase/server";
import { VisionDoc } from "@/components/VisionList";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const supabase = await createClient();
  // Before the 0005 setup runs there's no sort column yet, so fall back to creation order.
  let res = await supabase.from("visions").select("id, title, body").eq("status", "active").order("sort").order("created_at");
  if (res.error) res = await supabase.from("visions").select("id, title, body").eq("status", "active").order("created_at");
  const visions = (res.data ?? []).map((v) => ({ id: v.id, title: v.title, body: v.body ?? "" }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl">Vision</h1>
        <p className="mt-1 max-w-[56ch] text-muted">What&rsquo;s alive for you, in your words. Your partner reads this and asks you about it.</p>
      </div>
      <VisionDoc visions={visions} />
    </div>
  );
}
