import { createClient } from "@/lib/supabase/server";
import { SECTIONS, sectionOf, type PortfolioItem } from "@/lib/portfolio";
import { PortfolioAdmin } from "@/components/PortfolioAdmin";

export const dynamic = "force-dynamic";

/** Manage truetomax.com: upload photos, put them in order, and describe them. */
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const section = sectionOf(s ?? "")?.id ?? "pottery";
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const res = await supabase.from("portfolio_items").select("*").order("sort").order("created_at");
  const all = (res.error ? [] : res.data ?? []) as PortfolioItem[];
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
        <PortfolioAdmin key={section} section={section} items={all.filter((i) => i.section === section)} counts={counts} userId={user.user?.id ?? ""} />
      )}
    </div>
  );
}
