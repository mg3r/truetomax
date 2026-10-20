"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Shrink a photo before sending it, so big phone pictures upload quickly. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}

/** Import a list from a photo, PDF, Word or text file. Crossed-off items come in as done. */
export function TaskImport({ projectId }: { projectId: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function go(file: File) {
    setBusy(true);
    setNote(null);
    const form = new FormData();
    if (projectId) form.set("project_id", projectId);
    try {
      if (/\.(docx)$/i.test(file.name)) {
        const mammoth = await import("mammoth");
        const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        form.set("text", value);
      } else if (file.type === "text/plain" || /\.(txt|md)$/i.test(file.name)) {
        form.set("text", await file.text());
      } else if (file.type.startsWith("image/")) {
        form.set("file", new File([await shrink(file)], "list.jpg", { type: "image/jpeg" }));
      } else {
        form.set("file", file);
      }
      const res = await fetch("/api/tasks/import", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setNote(json.error ?? "Couldn't read that list.");
      else {
        const parts = [json.added && `${json.added} added to Up next`, json.finished && `${json.finished} crossed off`, json.already && `${json.already} already here`].filter(Boolean);
        setNote(parts.length ? `${parts.join(", ")}.` : "Nothing new on that list.");
        router.refresh();
      }
    } catch {
      setNote("Couldn't read that file.");
    }
    setBusy(false);
  }

  return (
    <div className="text-right">
      <button onClick={() => input.current?.click()} disabled={busy} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
        {busy ? "Reading your list…" : "Import a list"}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) go(f);
        }}
      />
      {note && <p role="status" className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  );
}
