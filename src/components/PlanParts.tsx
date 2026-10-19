import Link from "next/link";
import { saveVision } from "@/app/actions";
import { Select } from "@/components/Select";

export const HORIZONS = ["3 months", "1 year", "5 years", "10 years", "Lifetime"];

/** Practices as tappable chips inside a form. Submits practice_ids[]; practices_present tells the server to update links. */
export function PracticePicker({ practices, selected = [] }: { practices: { id: string; name: string }[]; selected?: string[] }) {
  if (!practices.length) return null;
  return (
    <fieldset>
      <legend className="text-sm text-muted">Which practices feed it?</legend>
      <input type="hidden" name="practices_present" value="1" />
      <div className="mt-2 flex flex-wrap gap-2">
        {practices.map((p) => (
          <label key={p.id} className="cursor-pointer">
            <input type="checkbox" name="practice_ids" value={p.id} defaultChecked={selected.includes(p.id)} className="peer sr-only" />
            <span className="btn-quiet peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">
              {p.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function VisionForm({ v }: { v?: { id: string; title: string; body: string; horizon: string } }) {
  return (
    <form action={saveVision} className="mt-4 space-y-4">
      {v && <input type="hidden" name="id" value={v.id} />}
      <input name="title" required defaultValue={v?.title} placeholder="Name this vision" aria-label="Vision name" className="field" />
      <textarea
        name="body"
        rows={5}
        defaultValue={v?.body}
        placeholder="What does it look like when it's real? Who's there? What are you making? How does money come in?"
        aria-label="Vision description"
        className="field"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Select name="horizon" label="Horizon" className="w-36" defaultValue={v?.horizon ?? "1 year"} options={HORIZONS.map((h) => ({ value: h, label: h }))} />
        <button className="btn">{v ? "Save changes" : "Add vision"}</button>
      </div>
    </form>
  );
}

export type CardData = {
  id: string;
  title: string;
  makesMoney: boolean;
  lastDone: string | null;
  next: string | null;
  practices: string[];
  vision?: string | null;
  goals: { id: string; title: string; current: number; target: number | null }[];
  counts: { today: number; next: number; later: number };
  shape: "pebble" | "pebble-alt";
};

function since(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

export function ProjectCard({ p }: { p: CardData }) {
  const quiet = !p.lastDone || Date.now() - new Date(p.lastDone).getTime() > 10 * 86400_000;
  return (
    <Link href={`/projects/${p.id}`} className={`${p.shape} flex h-full flex-col bg-surface p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--ink)]`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-xl leading-tight">{p.title}</h3>
        {p.makesMoney && <span className="shrink-0 text-xs text-muted">income</span>}
      </div>
      {(p.vision || p.practices.length > 0) && (
        <p className="mt-1 text-xs text-muted">{[p.vision && `Serves ${p.vision}`, p.practices.length && p.practices.join(", ")].filter(Boolean).join(" · ")}</p>
      )}
      <p className={`mt-1 text-xs ${quiet && p.lastDone ? "text-ink" : "text-muted"}`}>
        {p.lastDone ? `Last worked on ${since(p.lastDone)}${quiet ? ", gone quiet" : ""}` : "Nothing finished yet"}
      </p>

      <div className="mt-4">
        <p className="text-xs text-muted">Next step</p>
        <p className="mt-0.5 leading-snug">{p.next ?? <span className="text-muted">None set. Open it and add one.</span>}</p>
      </div>

      {p.goals.length > 0 && (
        <div className="mt-4 space-y-3">
          {p.goals.map((g) => (
            <div key={g.id}>
              <div className="flex justify-between gap-3 text-sm">
                <span className="truncate">{g.title}</span>
                {g.target != null && <span className="shrink-0 text-muted tabular-nums">{g.current}/{g.target}</span>}
              </div>
              {g.target != null && (
                <div className="mt-1 h-[2px] bg-line">
                  <div className="h-full bg-ink" style={{ width: `${Math.min(100, (g.current / g.target) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-auto pt-5 text-xs text-muted tabular-nums">
        {p.counts.today} today, {p.counts.next} up next, {p.counts.later} later
      </p>
    </Link>
  );
}
