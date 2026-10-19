import Link from "next/link";
import { saveVision } from "@/app/actions";
import { Select } from "@/components/Select";

export const HORIZONS = ["3 months", "1 year", "5 years", "10 years", "Lifetime"];

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
  vision: string | null;
  next: string | null;
  counts: { today: number; next: number; later: number };
  shape: "pebble" | "pebble-alt";
};

export function ProjectCard({ p }: { p: CardData }) {
  return (
    <Link href={`/projects/${p.id}`} className={`${p.shape} flex h-full flex-col bg-surface p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--ink)]`}>
      <h3 className="font-serif text-xl leading-tight">{p.title}</h3>
      <p className="mt-1 text-xs text-muted">{p.vision ? `Serves ${p.vision}` : "Not linked to a vision"}</p>
      <div className="mt-4">
        <p className="text-xs text-muted">Next step</p>
        <p className="mt-0.5 leading-snug">{p.next ?? <span className="text-muted">None yet. Open it and add one.</span>}</p>
      </div>
      <p className="mt-auto pt-5 text-xs text-muted tabular-nums">
        {p.counts.today} today, {p.counts.next} up next, {p.counts.later} later
      </p>
    </Link>
  );
}
