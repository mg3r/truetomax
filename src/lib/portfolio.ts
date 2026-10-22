/** The kinds of work truetomax.com shows. A section appears on the site once it has a published photo. */
export const SECTIONS = [
  { id: "pottery", title: "Pottery", blurb: "Cups, bowls and plates, made by hand to be used every day, at the table and in the kitchen." },
  { id: "art", title: "Art", blurb: "Paintings and drawings." },
  { id: "food", title: "Food", blurb: "Cooking, dinners and gatherings." },
  { id: "music", title: "DJ", blurb: "Sets and selections." },
  { id: "truetoyou", title: "truetoyou", blurb: "An app for living true to yourself." },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
export const sectionOf = (id: string) => SECTIONS.find((s) => s.id === id);

export type PortfolioItem = {
  id: string;
  section: string;
  image_path: string;
  title: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  sort: number;
  published: boolean;
  number?: number | null;
};

/** "No. 07": the piece's catalogue number. */
export const catalogNo = (n: number | null | undefined) => (n ? `No. ${String(n).padStart(2, "0")}` : null);

/** The public address of a photo in the portfolio bucket. */
export const photoUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/${path}`;

export const CONTACT = { email: "maxwellrgross@gmail.com", instagram: "truetomax" };

/** Every piece of text on the site, with what it says until you change it in Portfolio. */
export const SITE_TEXT_DEFAULTS: Record<string, string> = {
  home_title: "Things I make by hand.",
  home_intro: "I\u2019m Max. I make pottery, cook, paint and DJ. Here\u2019s the work, as it comes.",
  contact_title: "Interested in a piece?",
  contact_body: "Prices on request. I\u2019m also happy to make something for your table, your kitchen or your space.",
  ...Object.fromEntries(SECTIONS.flatMap((s) => [[`${s.id}_title`, s.title], [`${s.id}_blurb`, s.blurb]])),
};

export type SiteText = Record<string, string>;
export const withDefaults = (saved: Record<string, unknown> | null | undefined): SiteText => {
  const out: SiteText = { ...SITE_TEXT_DEFAULTS };
  for (const [k, v] of Object.entries(saved ?? {})) if (typeof v === "string" && v.trim()) out[k] = v;
  return out;
};
