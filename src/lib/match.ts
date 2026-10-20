/** Whether a calendar event and an item in the app are the same thing, judged by their names. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Whether something is already covered by an action: its title, or anything written in its notes
 * (a line, a bullet, or the same words appearing inside them).
 */
export function alreadyCovered(item: string, action: { title: string; reason?: string | null }) {
  if (sameThing(item, action.title)) return true;
  const notes = action.reason ?? "";
  if (!notes.trim()) return false;
  const x = norm(item);
  if (x.split(" ").length >= 3 && ` ${norm(notes)} `.includes(` ${x} `)) return true;
  return notes
    .split(/\n+|(?<=[.!?])\s+|^\s*[-•*\d.)]+\s*/m)
    .map((l) => l.replace(/^\s*[-•*]|\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 3)
    .some((l) => sameThing(item, l));
}

export function sameThing(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && ` ${long} `.includes(` ${short} `);
}
