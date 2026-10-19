import { createClient } from "@/lib/supabase/server";
import { loadMyVisions } from "@/app/actions";
import { MY_VISIONS } from "@/lib/visions";
import { VisionList } from "@/components/VisionList";
import { ActionButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function VisionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("visions").select("id, title, body, status").eq("status", "active").order("created_at");
  const visions = data ?? [];
  const toLoad = MY_VISIONS.filter((mv) => !visions.some((v) => v.title.trim().toLowerCase() === mv.title.toLowerCase()));

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-serif text-3xl">Visions</h1>
        <p className="mt-1 max-w-[56ch] text-muted">Where your life is heading. Tap any vision to edit it.</p>
      </div>

      {toLoad.length > 0 && visions.length <= 1 && (
        <section className="pebble border border-ink p-5">
          <p>Your five visions, written from your vision doc and journal, are ready.</p>
          <div className="mt-4">
            <ActionButton action={loadMyVisions} className="btn">Load my visions</ActionButton>
          </div>
        </section>
      )}

      <VisionList visions={visions.map((v) => ({ id: v.id, title: v.title, body: v.body ?? "" }))} />
    </div>
  );
}
