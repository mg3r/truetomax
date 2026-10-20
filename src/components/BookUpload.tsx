"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBookPages } from "@/app/actions";

type TextItem = { str: string; hasEOL?: boolean; transform: number[]; height: number };

/**
 * Reads your PDF in the browser and stores its text page by page.
 * The PDF itself never leaves your device; only the text goes to your private database.
 */
export function BookUpload({ existing }: { existing: { book: string; pages: number } | null }) {
  const router = useRouter();
  const [book, setBook] = useState(existing?.book ?? "The Creative Act");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      setStatus("Opening the PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

      const pages: { page: number; text: string }[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        setStatus(`Reading page ${n} of ${pdf.numPages}…`);
        const content = await (await pdf.getPage(n)).getTextContent();
        pages.push({ page: n, text: pageText(content.items as TextItem[]) });
      }

      const withText = pages.filter((p) => p.text.length > 0);
      if (withText.length < pdf.numPages / 4) {
        throw new Error("This PDF is mostly images, so there's no text to read. Try a PDF where you can select the text.");
      }

      // Send in small batches so a 200-page book doesn't hit request size limits.
      for (let i = 0; i < withText.length; i += 40) {
        setStatus(`Saving pages ${i + 1}–${Math.min(i + 40, withText.length)} of ${withText.length}…`);
        const res = await saveBookPages(book.trim() || "The Creative Act", withText.slice(i, i + 40), i === 0);
        if (res.error) throw new Error(res.error);
      }
      setStatus(`Added ${withText.length} pages. A page will open on Today each morning, starting tomorrow (or tap ↻ next to the date on Today).`);
      router.refresh();
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Couldn't read that PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {existing && <p className="text-sm">{existing.book}: {existing.pages} pages added.</p>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="book-title" className="block text-sm text-muted">Book title</label>
          <input id="book-title" className="field" value={book} onChange={(e) => setBook(e.target.value)} disabled={busy} />
        </div>
        <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
          {existing ? "Replace PDF" : "Choose PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {status && <p role="status" className="text-sm text-muted">{status}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Rebuild lines and paragraphs from positioned text: a bigger vertical gap than usual starts a new paragraph. */
function pageText(items: TextItem[]) {
  let out = "";
  let lastY: number | null = null;
  let lastH = 0;
  for (const it of items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 0.5 && it.str.trim()) {
      const paragraph = Math.abs(lastY - y) > (lastH || it.height || 12) * 1.7;
      out = out.replace(/\s+$/, "") + (paragraph ? "\n\n" : "\n");
    } else if (it.hasEOL && !out.endsWith(" ")) {
      out += " ";
    }
    out += it.str;
    if (it.str.trim()) {
      lastY = y;
      lastH = it.height || lastH;
    }
  }
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/-\n(?=[a-z])/g, "") // rejoin hyphenated line breaks
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
