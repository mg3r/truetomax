import { createClient } from "@/lib/supabase/server";
import { VisionDoc } from "@/components/VisionList";
import { VisionEditor } from "@/components/VisionEditor";

export const dynamic = "force-dynamic";

export default async function VisionPage() {
  const supabase = await createClient();
  const doc = await supabase.from("vision_doc").select("html").maybeSingle();

  // Until the Vision page migration runs, keep the older sections so nothing is lost.
  if (doc.error) {
    let res = await supabase.from("visions").select("id, title, body").eq("status", "active").order("sort").order("created_at");
    if (res.error) res = await supabase.from("visions").select("id, title, body").eq("status", "active").order("created_at");
    const visions = (res.data ?? []).map((v) => ({ id: v.id, title: v.title, body: v.body ?? "" }));
    return (
      <div className="space-y-8">
        <h1 className="font-serif text-3xl">Vision</h1>
        <p className="text-sm text-muted">Run <code>0022_vision_doc.sql</code> in Supabase to turn this into one page you write freely.</p>
        <VisionDoc visions={visions} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Vision</h1>
      <VisionEditor initial={doc.data?.html ?? ""} />
    </div>
  );
}
