import { createClient } from "@/lib/supabase/server";
import { SECTIONS, SITE_TEXT_DEFAULTS, sectionOf, withDefaults, type PortfolioItem } from "@/lib/portfolio";
import { PortfolioAdmin } from "@/components/PortfolioAdmin";
import { SectionText, HomeText } from "@/components/SiteTextEditor";
import { Collapsible } from "@/components/Collapsible";

export const dynamic = "force-dynamic";

/** Manage truetomax.com: upload photos, put them in order, and describe them. */
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const section = sectionOf(s ?? "")?.id ?? "pottery";
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const res = await supabase.from("portfolio_items").select("*").order("sort").order("created_at");
  const all = (res.error ? [] : res.data ?? []) as PortfolioItem[];
  const saved = await supabase.from("site_text").select("content").maybeSingle();
  const text = withDefaults(saved.error ? null : (saved.data?.content as Record<string, unknown> | undefined));
  const counts = Object.fromEntries(SECTIONS.map((x) => [x.id, all.filter((i) => i.section === x.id).length]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-serif text-3xl">Portfolio</h1>
        <div className="flex gap-4 text-sm">
          <a href={`/site/${section}`} target="_blank" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">Preview</a>
          <a href={`https://www.truetomax.com/${section}`} target="_blank" rel="noopener noreferrer" className="text-muted underline decoration-line underline-offset-4 hover:text-ink">truetomax.com/{section}</a>
        </div>
      </div>
      {res.error ? (
        <p className="text-muted">Run <code>0026_portfolio.sql</code> in Supabase to turn on your portfolio.</p>
      ) : (
        <>
          {/* Every word on the site is editable here: click, type, click away. */}
          {saved.error ? (
            <p className="text-sm text-muted">Run <code>0028_site_text.sql</code> in Supabase to edit the site&rsquo;s text here.</p>
          ) : (
            <Collapsible id="site-home-text" title="home page and contact">
              <div className="mt-3">
                <HomeText text={text} defaults={SITE_TEXT_DEFAULTS} />
              </div>
            </Collapsible>
          )}
          <PortfolioAdmin
            key={section}
            section={section}
            items={all.filter((i) => i.section === section)}
            counts={counts}
            userId={user.user?.id ?? ""}
            pageText={saved.error ? null : <SectionText key={section} section={section} text={text} defaults={SITE_TEXT_DEFAULTS} />}
          />
        </>
      )}
    </div>
  );
}
