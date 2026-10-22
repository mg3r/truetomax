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
