import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addIdea, ideaToProject, contentIdeaToTask, setIdeaStatus } from "@/app/actions";
import { AskPartner } from "@/components/AskPartner";
import { ActionButton } from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

type Idea = { id: string; kind: string; title: string; body: string; first_step: string | null; money_path: string | null; status: string; status_note: string | null; project_id: string | null; source: string };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const kind = tab === "content" ? "content" : "venture";
  const supabase = await createClient();
  const { data } = await supabase.from("ideas").select("*").eq("kind", kind).order("created_at", { ascending: false });
  const ideas = (data ?? []) as Idea[];
  const live = ideas.filter((i) => i.status === "new" || i.status === "exploring");
  const planned = ideas.filter((i) => i.status === "planned");
  const eliminated = ideas.filter((i) => i.status === "eliminated");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl">Ideas</h1>
        <p className="mt-1 text-muted">
          {kind === "venture"
            ? "Feasible ways to earn from what you already do. Test one, or eliminate it and say why."
            : "Posts and series for truetomax, drawn from what you're actually making this week."}
        </p>
        <div className="mt-4 flex gap-1" role="tablist">
          <Link role="tab" aria-selected={kind === "venture"} href="/ideas" className={`rounded-full px-3 py-1 text-sm ${kind === "venture" ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>Work & income</Link>
          <Link role="tab" aria-selected={kind === "content"} href="/ideas?tab=content" className={`rounded-full px-3 py-1 text-sm ${kind === "content" ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>Sharing</Link>
        </div>
      </div>

      <AskPartner endpoint="/api/ideas" body={{ kind }} label={kind === "venture" ? "Surface 3 new ideas" : "Suggest 3 posts"} busyLabel="Thinking it through…" />

      <section className="space-y-4">
        {live.map((i) => (
          <article key={i.id} className="pebble bg-surface p-4 sm:p-5">
            <h2 className="font-semibold">{i.title}</h2>
            {i.body && <p className="mt-1 text-muted">{i.body}</p>}
            {i.money_path && <p className="mt-3 text-sm"><span className="font-semibold">Money path:</span> {i.money_path}</p>}
            {i.first_step && <p className="mt-1 text-sm"><span className="font-semibold">First step:</span> {i.first_step}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {kind === "venture" ? (
                <ActionButton action={ideaToProject.bind(null, i.id)} className="btn">Make it a project</ActionButton>
              ) : (
                <ActionButton action={contentIdeaToTask.bind(null, i.id)} className="btn">Add to today</ActionButton>
              )}
            </div>
            <form action={setIdeaStatus} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="status" value="eliminated" />
              <input name="note" placeholder="Not for me because…" aria-label="Why eliminate" className="field min-w-0 flex-1 !py-1.5 text-sm" />
              <button className="btn-quiet">Eliminate</button>
            </form>
          </article>
        ))}
        {!live.length && <p className="text-muted">No open ideas. Ask your partner for some, or add your own below.</p>}
      </section>

      <details className="pebble border border-dashed border-line p-4">
        <summary className="cursor-pointer font-semibold">Add your own idea</summary>
        <form action={addIdea} className="mt-4 space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <input name="title" required placeholder="The idea" aria-label="Idea" className="field" />
          <textarea name="body" rows={3} placeholder="Details" aria-label="Details" className="field" />
          <button className="btn">Add idea</button>
        </form>
      </details>

      {planned.length > 0 && (
        <section>
          <h2 className="section-title">In motion</h2>
          <ul className="mt-2 space-y-1">
            {planned.map((i) => (
              <li key={i.id}>
                {i.project_id ? <Link href={`/projects/${i.project_id}`} className="underline decoration-line underline-offset-4">{i.title}</Link> : i.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      {eliminated.length > 0 && (
        <section>
          <h2 className="section-title">Eliminated</h2>
          <p className="mt-1 text-sm text-muted">Each one narrows the path. Your partner won&rsquo;t suggest these again.</p>
          <ul className="mt-3 space-y-2">
            {eliminated.map((i) => (
              <li key={i.id} className="text-muted">
                <span className="line-through decoration-line">{i.title}</span>
                {i.status_note && <span className="text-sm">: {i.status_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
