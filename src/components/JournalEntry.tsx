"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateJournal } from "@/app/actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** A saved entry: tap the text to edit it; it saves when you tap away. */
export function JournalEntry({ e }: { e: { id: string; prompt: string | null; body: string; created_at: string; updated_at: string } }) {
  const [body, setBody] = useState(e.body);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setBody(e.body);
  }, [e.body]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  const edited = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 60_000;
  const sameDay = new Date(e.updated_at).toDateString() === new Date(e.created_at).toDateString();

  return (
    <div>
      <p suppressHydrationWarning className="text-sm text-muted">
        {when(e.created_at)}
        {edited && <span> · edited {sameDay ? time(e.updated_at) : when(e.updated_at)}</span>}
        <span aria-live="polite">{pending ? " · saving…" : saved ? " · saved" : ""}</span>
      </p>
      {e.prompt && <p className="mt-2 font-serif italic text-muted">{e.prompt}</p>}
      <textarea
        ref={ref}
        rows={1}
        value={body}
        onChange={(ev) => setBody(ev.target.value)}
        onBlur={() => {
          if (!body.trim()) return setBody(e.body);
          if (body === e.body) return;
          start(async () => {
            await updateJournal(e.id, body);
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
          });
        }}
        aria-label="Journal entry"
        className="mt-2 block w-full max-w-[65ch] resize-none overflow-hidden bg-transparent font-serif text-lg leading-relaxed focus:outline-none"
      />
    </div>
  );
}
