import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveVision, setVisionStatus } from "@/app/actions";
import { ActionButton } from "@/components/DeleteButton";
import { Select } from "@/components/Select";

export const dynamic = "force-dynamic";

const HORIZONS = ["3 months", "1 year", "5 years", "Lifetime"];

export default async function VisionsPage() {
  const supabase = await createClient();
  const [visions, projects] = await Promise.all([
    supabase.from("visions").select("*").order("created_at"),
    supabase.from("projects").select("id, title, vision_id, status").eq("status", "active"),
  ]);
  const active = (visions.data ?? []).filter((v) => v.status === "active");
  const past = (visions.data ?? []).filter((v) => v.status !== "active");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl">Visions</h1>
        <p className="mt-1 text-muted">Where you&rsquo;re headed. Write them the way you&rsquo;d describe them to a friend; your partner plans from here.</p>
      </div>

      <section className="space-y-8">
        {active.map((v) => {
          const linked = (projects.data ?? []).filter((p) => p.vision_id === v.id);
          return (
            <article key={v.id} className="border-t border-line pt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl leading-tight">{v.title}</h2>
                <span className="shrink-0 text-sm text-muted">{v.horizon}</span>
              </div>
              {v.body && <p className="mt-3 max-w-[65ch] font-serif text-lg leading-relaxed whitespace-pre-wrap">{v.body}</p>}
              {linked.length > 0 && (
                <p className="mt-3 text-sm text-muted">
                  Projects:{" "}
                  {linked.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && ", "}
                      <Link href={`/projects/${p.id}`} className="text-ink underline decoration-line underline-offset-4">{p.title}</Link>
                    </span>
                  ))}
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted hover:text-ink">Edit</summary>
                <VisionForm v={v} />
                <div className="mt-3 flex gap-2">
                  <ActionButton action={setVisionStatus.bind(null, v.id, "realized")}>Realized</ActionButton>
                  <ActionButton action={setVisionStatus.bind(null, v.id, "released")}>Release it</ActionButton>
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <details className="pebble border border-dashed border-line p-4" open={active.length === 0}>
        <summary className="cursor-pointer font-semibold">Add a vision</summary>
        <VisionForm />
      </details>

      {past.length > 0 && (
        <section>
          <h2 className="section-title">Realized and released</h2>
          <ul className="mt-2 space-y-2">
            {past.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between gap-3 text-muted">
                <span>{v.title} <span className="text-xs">({v.status})</span></span>
                <ActionButton action={setVisionStatus.bind(null, v.id, "active")} className="text-xs text-muted hover:text-ink">Bring back</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function VisionForm({ v }: { v?: { id: string; title: string; body: string; horizon: string } }) {
  return (
    <form action={saveVision} className="mt-4 space-y-3">
      {v && <input type="hidden" name="id" value={v.id} />}
      <input name="title" required defaultValue={v?.title} placeholder="Name this vision" aria-label="Vision name" className="field" />
      <textarea name="body" rows={5} defaultValue={v?.body} placeholder="What does it look like when it's real? Who's there? What are you making? How does money come in?" aria-label="Vision description" className="field" />
      <div className="flex gap-3">
        <Select name="horizon" label="Horizon" className="w-36" defaultValue={v?.horizon ?? "1 year"} options={HORIZONS.map((h) => ({ value: h, label: h }))} />
        <button className="btn">{v ? "Save changes" : "Add vision"}</button>
      </div>
    </form>
  );
}
