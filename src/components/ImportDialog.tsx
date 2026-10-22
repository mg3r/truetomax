"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isHeic, toJpeg } from "@/lib/images";

type Kind = "actions" | "projects" | "visions";

const COPY: Record<Kind, { button: string; title: string; hint: string; busy: string }> = {
  actions: { button: "Import actions", title: "Import actions", hint: "A to-do list. Crossed-off items come in as done; new ones go to Up next.", busy: "Reading your list…" },
  projects: { button: "Import projects", title: "Import projects", hint: "A list or write-up of projects. Each becomes a project with its goals and actions.", busy: "Studying your projects…" },
  visions: { button: "Import visions", title: "Import visions", hint: "Your notes or doc. Each concept becomes its own section, in your words.", busy: "Reading your vision…" },
};

/** Shrink a photo before sending it, so big phone pictures upload quickly. */
async function shrink(file: File): Promise<Blob> {
  return (await toJpeg(file, 2000, 0.85)).blob;
}

/** One import pop-up for actions, projects and visions: paste text, paste a Google Doc link, upload a file, or a photo. */
export function ImportDialog({ kind, projectId = null }: { kind: Kind; projectId?: string | null }) {
  const copy = COPY[kind];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function send(build: (form: FormData) => Promise<void>) {
    setBusy(true);
    setNote(null);
    const form = new FormData();
    form.set("kind", kind);
    if (projectId) form.set("project_id", projectId);
    try {
      await build(form);
      const res = await fetch("/api/import", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setNote(json.error ?? "Couldn't read that.");
      else {
        setNote(`${json.note}.`.replace(/\.\.$/, "."));
        setText("");
        router.refresh();
      }
    } catch (e) {
      console.error("import", e);
      setNote("Couldn't open that file. If it's a photo, try a screenshot of it, or paste the text instead.");
    }
    setBusy(false);
  }

  const sendText = () => {
    const value = text.trim();
    if (!value) return;
    // A pasted Google Doc link is read in full on the server, every tab.
    const isLink = /^https?:\/\/docs\.google\.com\/\S+$/.test(value);
    send(async (form) => form.set(isLink ? "link" : "text", value));
  };

  const sendFile = (file: File) =>
    send(async (form) => {
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        form.set("text", value);
      } else if (file.type === "text/plain" || /\.(txt|md)$/i.test(file.name)) form.set("text", await file.text());
      else if (file.type.startsWith("image/") || isHeic(file)) form.set("file", new File([await shrink(file)], "page.jpg", { type: "image/jpeg" }));
      else form.set("file", file);
    });

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) sendFile(f);
  };

  const quiet = "rounded-full border border-line px-3.5 py-1.5 text-sm text-muted hover:border-ink hover:text-ink disabled:opacity-50";

  return (
    <>
      <button type="button" onClick={() => { setNote(null); setOpen(true); }} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
        {copy.button}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onClick={() => !busy && setOpen(false)}>
          {/* Drop a file anywhere on the pop-up to import it. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => {
              if (busy || !e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && !busy) sendFile(f);
            }}
            className={`relative w-full max-w-lg rounded-3xl border bg-bg p-5 shadow-[0_12px_48px_-12px_rgb(0_0_0/0.35)] transition-colors ${over ? "border-clay" : "border-line"}`}
          >
            {over && (
              <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border border-dashed border-clay bg-bg/90 text-sm text-clay">
                Drop to import
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-xl">{copy.title}</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">{copy.hint}</p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              rows={7}
              autoFocus
              placeholder="Paste text or a Google Doc link, or drop a file here"
              className="mt-4 w-full resize-y rounded-2xl border border-line bg-surface p-3 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={sendText} disabled={busy || !text.trim()} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg disabled:opacity-40">
                Import
              </button>
              <span className="text-xs text-muted">or</span>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={quiet}>
                Upload a file
              </button>
              <button type="button" onClick={() => photoInput.current?.click()} disabled={busy} className={quiet}>
                Photo
              </button>
            </div>
            <input ref={fileInput} type="file" accept="application/pdf,.docx,.txt,.md,image/*,.heic,.heif" className="hidden" onChange={pick} />
            {/* On a phone this offers the photo library or the camera. */}
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={pick} />

            {(busy || note) && (
              <p role="status" className="mt-3 text-sm text-muted">
                {busy ? copy.busy : note}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
