"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContextDoc, addGoogleDoc } from "@/app/actions";

type TextItem = { str: string; hasEOL?: boolean };

/** Read a file's text on this device: PDF, Word, or plain text. Only the text is saved. */
async function readFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      pages.push((content.items as TextItem[]).map((it) => it.str + (it.hasEOL ? "\n" : "")).join(""));
    }
    return pages.join("\n\n");
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  return file.text();
}

export function DocUpload() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList) {
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      try {
        setStatus(`Reading ${file.name}…`);
        const text = await readFile(file);
        const res = await addContextDoc(file.name.replace(/\.[^.]+$/, ""), text);
        if (res.error) throw new Error(res.error);
      } catch (e) {
        setError(e instanceof Error ? `${file.name}: ${e.message}` : `Couldn't read ${file.name}.`);
      }
    }
    setStatus(null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <label className={`btn cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
        Upload files
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) handle(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <span className="ml-3 text-xs text-muted">PDF, Word, or text</span>
      {status && <p role="status" className="mt-2 text-sm text-muted">{status}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function GoogleDocLink({ connected }: { connected: boolean }) {
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!connected) {
    return <p className="text-sm text-muted">Connect Google in Settings to link Google Docs here. They stay in sync when you tap Refresh.</p>;
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addGoogleDoc(link);
          if (res.error) setError(res.error);
          else setLink("");
        });
      }}
    >
      <div className="flex gap-2">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Google Docs link" aria-label="Google Docs link" className="field min-w-0 flex-1" />
        <button className="btn" disabled={pending || !link.trim()}>{pending ? "Reading…" : "Add"}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
