import Link from "next/link";
import { SECTIONS, photoUrl } from "@/lib/portfolio";
import { publishedItems, siteBase } from "@/lib/portfolioData";

export const revalidate = 60;

/** truetomax.com: who Max is, and each body of work that has something to show. */
export default async function SiteHome() {
  const [items, base] = await Promise.all([publishedItems(), siteBase()]);
  const live = SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.id) })).filter((s) => s.items.length);

  return (
    <main>
      <section className="pt-16 pb-14 sm:pt-24">
        <h1 className="max-w-[16ch] font-serif text-[2.6rem] leading-[1.05] font-normal tracking-[-0.02em] sm:text-[4rem]">Things I make by hand.</h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          I&rsquo;m Max. I make pottery, cook, paint and DJ. Here&rsquo;s the work, as it comes.
        </p>
      </section>

      {live.length ? (
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {live.map((s) => (
            <Link key={s.id} href={`${base}/${s.id}`} className="group block">
              <div className="aspect-[4/5] overflow-hidden rounded-md bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(s.items[0].image_path)} alt={s.items[0].title ?? s.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]" />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-2xl group-hover:text-clay">{s.title}</h2>
                <span className="text-sm text-muted">{s.items.length} {s.items.length === 1 ? "piece" : "pieces"}</span>
              </div>
              <p className="mt-1 text-muted">{s.blurb}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted">New work coming soon.</p>
      )}
    </main>
  );
}
