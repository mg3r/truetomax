"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Note = { id: number; text: string; href?: string; link?: string };

/** Say briefly what just happened ("Added to Up next"), with a link to where it went. */
export function notify(text: string, href?: string, link?: string) {
  window.dispatchEvent(new CustomEvent("ttm:notify", { detail: { text, href, link } }));
}

export function Toaster() {
  const [note, setNote] = useState<Note | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      const d = (e as CustomEvent<Omit<Note, "id">>).detail;
      setNote({ id: Date.now(), ...d });
      clearTimeout(timer);
      timer = setTimeout(() => setNote(null), 5000);
    };
    window.addEventListener("ttm:notify", on);
    return () => {
      window.removeEventListener("ttm:notify", on);
      clearTimeout(timer);
    };
  }, []);
  if (!note) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-8">
      <div key={note.id} className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">
        <span>{note.text}</span>
        {note.href && (
          <Link href={note.href} onClick={() => setNote(null)} className="underline underline-offset-4">
            {note.link ?? "See it"}
          </Link>
        )}
      </div>
    </div>
  );
}
