/** The Vision page's formatting turned into plain text the partner reads: titles as #, bullets as -, numbers kept. */
export function visionText(html: string) {
  let n = 0;
  return html
    .replace(/<ol[^>]*>/g, () => {
      n = 0;
      return "\n";
    })
    .replace(/<\/ol>/g, "\n")
    .replace(/<ul[^>]*>|<\/ul>/g, "\n")
    .replace(/<h1[^>]*>/g, "\n# ")
    .replace(/<h2[^>]*>/g, "\n## ")
    .replace(/<h3[^>]*>/g, "\n### ")
    .replace(/<\/h[1-3]>/g, "\n")
    .replace(/<li[^>]*>(\s*<p[^>]*>)?/g, (m, _p, offset, all) => {
      // Numbered if the nearest list opened before this item is an <ol>.
      const before = all.slice(0, offset);
      const ol = before.lastIndexOf("<ol");
      const ul = before.lastIndexOf("<ul");
      return ol > ul ? `\n${++n}. ` : "\n- ";
    })
    .replace(/<\/li>|<\/p>/g, "")
    .replace(/<p[^>]*>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
