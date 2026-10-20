import Link from "next/link";


export type CardData = {
  id: string;
  title: string;
  next: string | null;
  counts: { today: number; next: number; later: number };
  shape: "pebble" | "pebble-alt";
};

export function ProjectCard({ p }: { p: CardData }) {
  return (
    <Link href={`/projects/${p.id}`} className={`${p.shape} flex h-full flex-col bg-surface p-5 transition-shadow hover:shadow-[0_0_0_1px_var(--ink)]`}>
      <h3 className="pr-7 font-serif text-xl leading-tight">{p.title}</h3>
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
