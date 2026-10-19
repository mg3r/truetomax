"use client";

import { useState, useTransition } from "react";
import { Grow } from "./Grow";
import { updateVision, createVision, deleteVision } from "@/app/actions";

type Vision = { id: string; title: string; body: string };

function VisionSection({ v }: { v: Vision }) {
  const [title, setTitle] = useState(v.title);
  const [body, setBody] = useState(v.body);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [confirming, setConfirming] = useState(false);
  const [, start] = useTransition();

  function save(fields: { title?: string; body?: string }) {
    setSaved("saving");
    start(async () => {
      await updateVision(v.id, fields);
      setSaved("saved");
      setTimeout(() => setSaved("idle"), 1500);
    });
  }

  return (
    <section className="group border-t border-line pt-7">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== v.title && save({ title })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Vision name"
        className="w-full bg-transparent font-serif text-[1.8rem] leading-tight tracking-[-0.01em] focus:outline-none"
      />
      <Grow
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => body !== v.body && save({ body })}
        placeholder="Describe it the way you'd tell a friend. What does it look like when it's real?"
        aria-label={`${title} description`}
        className="mt-2 w-full resize-none overflow-hidden bg-transparent font-serif text-[1.08rem] leading-relaxed placeholder:text-muted focus:outline-none"
      />
      <div className="mt-1 flex h-5 items-center justify-between text-xs text-muted">
        <span aria-live="polite">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}</span>
        {confirming ? (
          <span className="flex gap-3">
            <button className="hover:text-danger" onClick={() => start(() => deleteVision(v.id))}>Remove it</button>
            <button className="hover:text-ink" onClick={() => setConfirming(false)}>Keep</button>
          </span>
        ) : (
          <button className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-danger focus:opacity-100" onClick={() => setConfirming(true)}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}

export function VisionList({ visions }: { visions: Vision[] }) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-10">
      <form
        className="pebble border border-dashed border-line px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          setDraft("");
          start(() => createVision(t));
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={pending ? "Adding…" : "Add a vision"}
          aria-label="New vision name, then press Enter"
          className="w-full bg-transparent font-serif text-xl leading-tight placeholder:text-muted focus:outline-none"
        />
      </form>
      {visions.map((v) => <VisionSection key={v.id} v={v} />)}
    </div>
  );
}
