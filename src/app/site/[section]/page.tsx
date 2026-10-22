import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONTACT, sectionOf, photoUrl, catalogNo } from "@/lib/portfolio";
import { publishedItems } from "@/lib/portfolioData";
import { Gallery } from "@/components/site/Gallery";

// Always fresh: what you change in Portfolio (order, words, hiding) shows on the next visit.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const s = sectionOf(section);
  if (!s) return {};
  const items = await publishedItems(section);
  return {
    title: s.title,
    description: s.blurb,
    openGraph: { title: `${s.title} · Max Gross`, description: s.blurb, images: items[0] ? [photoUrl(items[0].image_path)] : [] },
  };
}

/** One body of work, e.g. truetomax.com/pottery: the photos in your order, with your words. */
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const s = sectionOf(section);
  if (!s) notFound();
  const items = await publishedItems(section);

  return (
    <main>
      <section className="pt-12 pb-10 sm:pt-16">
        <h1 className="font-serif text-[2.6rem] leading-[1.05] font-normal tracking-[-0.02em] sm:text-[3.6rem]">{s.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{s.blurb}</p>
      </section>

      {items.length ? (
        <Gallery email={CONTACT.email} items={items.map((i) => ({ src: photoUrl(i.image_path), no: catalogNo(i.number), title: i.title, description: i.description, width: i.width, height: i.height }))} />
      ) : (
        <p className="text-muted">New work coming soon.</p>
      )}

      <section className="mt-14 max-w-xl">
        <h2 className="font-serif text-2xl">Interested in a piece?</h2>
        <p className="mt-2 text-muted">Prices on request. I&rsquo;m also happy to make something for your table, your kitchen or your space.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`Your ${s.title.toLowerCase()}`)}`} className="rounded-full border border-line px-4 py-2 hover:border-clay hover:text-clay">
            Email me
          </a>
          <a href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-4 py-2 hover:border-clay hover:text-clay">
            Instagram
          </a>
        </div>
      </section>
    </main>
  );
}
