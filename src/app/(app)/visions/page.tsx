import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setVisionStatus, loadMyVisions } from "@/app/actions";
import { MY_VISIONS } from "@/lib/visions";
import { VisionForm } from "@/components/PlanParts";
import { ActionButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function VisionsPage() {
  const supabase = await createClient();
  const [visions, projects, open] = await Promise.all([
    supabase.from("visions").select("*").order("created_at"),
    supabase.from("projects").select("id, title, vision_id").eq("status", "active").order("created_at"),
    supabase.from("tasks").select("project_id").eq("status", "todo").not("project_id", "is", null),
  ]);

  const active = (visions.data ?? []).filter((v) => v.status === "active");
  const past = (visions.data ?? []).filter((v) => v.status !== "active");
  const openCount = (id: string) => (open.data ?? []).filter((t) => t.project_id === id).length;
  const toLoad = MY_VISIONS.filter((mv) => !active.some((v) => v.title.trim().toLowerCase() === mv.title.toLowerCase()));

  return (
    <div className="space-y-14">
      <div>
        <h1 className="font-serif text-3xl">Visions</h1>
        <p className="mt-1 max-w-[56ch] text-muted">Where your life is heading. Projects serve these.</p>
      </div>

      {toLoad.length > 0 && (
        <section aria-labelledby="load" className="pebble border border-ink p-5">
          <h2 id="load" className="font-serif text-xl">Your visions are ready</h2>
          <p className="mt-1 text-sm text-muted">{MY_VISIONS.map((v) => v.title).join(", ")}. Written from your vision doc and journal; edit any of them after loading.</p>
          <div className="mt-4">
            <ActionButton action={loadMyVisions} className="btn">Load my visions</ActionButton>
          </div>
        </section>
      )}

      {active.map((v) => {
        const serving = (projects.data ?? []).filter((p) => p.vision_id === v.id);
        return (
          <article key={v.id} className="border-t border-line pt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[1.9rem] leading-tight tracking-[-0.01em]">{v.title}</h2>
              <span className="shrink-0 text-sm text-muted">{v.horizon}</span>
            </div>
            {v.body && <div className="mt-3 max-w-[62ch] font-serif text-[1.08rem] leading-relaxed whitespace-pre-wrap">{v.body}</div>}

            <div className="mt-6">
              <h3 className="section-title">projects serving this</h3>
              {serving.length ? (
                <ul className="mt-2 divide-y divide-line">
                  {serving.map((p) => (
                    <li key={p.id}>
                      <Link href={`/projects/${p.id}`} className="flex items-baseline justify-between gap-4 py-2.5 hover:text-ink">
                        <span>{p.title}</span>
                        <span className="shrink-0 text-xs text-muted tabular-nums">{openCount(p.id)} open tasks</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">None yet.</p>
              )}
              <Link href={`/projects?vision=${v.id}#new`} className="mt-3 inline-block text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
                Start a project for this vision
              </Link>
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted hover:text-ink">Edit vision</summary>
              <VisionForm v={v} />
              <div className="mt-3 flex gap-2">
                <ActionButton action={setVisionStatus.bind(null, v.id, "realized")}>Realized</ActionButton>
                <ActionButton action={setVisionStatus.bind(null, v.id, "released")}>Release it</ActionButton>
              </div>
            </details>
          </article>
        );
      })}

      <details className="pebble border border-dashed border-line p-5" open={active.length === 0 && toLoad.length === 0}>
        <summary className="cursor-pointer font-medium">Add a vision</summary>
        <VisionForm />
      </details>

      {past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="section-title">realized and released</h2>
          <ul className="mt-2 divide-y divide-line">
            {past.map((v) => (
              <li key={v.id} className="flex items-baseline justify-between gap-3 py-2.5 text-muted">
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
