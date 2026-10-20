/**
 * Today's reading as a whole section of the book, not a page cut off mid-thought.
 * A PDF splits text at page breaks, so starting from the chosen page we walk back to where its section
 * starts and forward to where it ends. A section starts at a heading (a short title line on its own) and
 * ends just before the next one, or on a page that stops short of a full page.
 */

export type BookPage = { page: number; text: string };
export type Passage = { title: string | null; text: string; from: number; to: number };

const ENDS = /[.!?…]["”’)\]]*\s*$/;
const MAX_PAGES = 8;

/** The page's first real line, if it reads as a section heading. */
function headingOf(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+$/.test(l)); // skip page numbers
  if (lines.length < 2) return null;
  const first = lines[0];
  const words = first.split(/\s+/).length;
  if (first.length > 50 || words > 7) return null;
  if (/[.,;:!?…"”]$/.test(first)) return null;
  if (!/^[A-Z0-9“"]/.test(first)) return null;
  return first;
}

function median(ns: number[]) {
  const s = [...ns].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

export function sectionAround(center: BookPage, around: BookPage[]): Passage {
  const pages = new Map([...around, center].map((p) => [p.page, p.text.trim()]));
  const full = median([...pages.values()].map((t) => t.length).filter((n) => n > 200));
  // A page that stops well short of a full page, on a finished sentence, closes its section.
  const endsShort = (n: number) => {
    const t = pages.get(n);
    return !!t && full > 0 && t.length < full * 0.6 && ENDS.test(t);
  };
  // If most pages "start with a heading", it's a running header, not a section title: ignore it.
  const headed = [...pages.values()].filter((t) => headingOf(t)).length;
  const useHeadings = headed <= pages.size / 2;
  const heading = (t: string) => (useHeadings ? headingOf(t) : null);
  const startsSection = (n: number) => !!pages.get(n) && (!!heading(pages.get(n)!) || endsShort(n - 1));

  let from = center.page;
  while (!startsSection(from) && pages.has(from - 1) && center.page - from < MAX_PAGES) from--;
  let to = center.page;
  while (!endsShort(to) && pages.has(to + 1) && !startsSection(to + 1) && to - from < MAX_PAGES) to++;

  const title = heading(pages.get(from) ?? "");
  let text = "";
  for (let n = from; n <= to; n++) {
    let t = pages.get(n) ?? "";
    if (n === from && title) t = t.slice(t.indexOf(title) + title.length).trim();
    t = t.replace(/^\d+\s*\n/, "").replace(/\n\d+\s*$/, ""); // page numbers
    // Join across the page break: a sentence that runs on continues in the same paragraph.
    if (!text) text = t;
    else if (ENDS.test(text)) text = `${text}\n\n${t}`;
    else text = /-$/.test(text) ? `${text.slice(0, -1)}${t}` : `${text} ${t}`;
  }
  // Never stop mid-sentence: if the section's last page runs on, finish the sentence from the next page.
  const next = pages.get(to + 1);
  if (!ENDS.test(text) && next) {
    const m = next.match(/^[\s\S]*?[.!?…]["”’)\]]*(?=\s|$)/);
    if (m && m[0].length < 800) text = `${text} ${m[0].trim()}`;
  }
  return { title, text: text.trim(), from, to };
}
