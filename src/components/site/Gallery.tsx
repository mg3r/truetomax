"use client";

import { useEffect, useRef, useState } from "react";

type Photo = { src: string; title: string | null; description: string | null; width: number | null; height: number | null };

/** The work in columns; tap a photo to see it large, then swipe or use the arrow keys. */
export function Gallery({ items }: { items: Photo[] }) {
  const [at, setAt] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const x0 = useRef<number | null>(null);

  useEffect(() => {
    if (at === null) dlg.current?.close();
    else if (!dlg.current?.open) dlg.current?.showModal();
  }, [at]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (at === null) return;
      if (e.key === "ArrowRight") setAt((i) => (i! + 1) % items.length);
      if (e.key === "ArrowLeft") setAt((i) => (i! - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [at, items.length]);

  const open = at === null ? null : items[at];

  // Columns that read in your order, left to right: each photo goes into the shortest column so far.
  // (Plain CSS columns fill top to bottom, which scrambled the order you set.)
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const fit = () => setCols(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const columns: { p: Photo; i: number }[][] = Array.from({ length: cols }, () => []);
  const heights = Array(cols).fill(0);
  items.forEach((p, i) => {
    const c = heights.indexOf(Math.min(...heights));
    columns[c].push({ p, i });
    heights[c] += (p.width && p.height ? p.height / p.width : 1.25) + (p.title || p.description ? 0.18 : 0) + 0.06;
  });

  return (
    <>
      <div className="flex gap-5">
        {columns.map((col, c) => (
          <div key={c} className="min-w-0 flex-1">
            {col.map(({ p, i }) => (
          <figure key={p.src} className="mb-8">
            <button type="button" onClick={() => setAt(i)} className="group block w-full cursor-zoom-in overflow-hidden rounded-md bg-surface" aria-label={`Open ${p.title ?? `photo ${i + 1}`}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.title ?? "Work by Max Gross"}
                width={p.width ?? undefined}
                height={p.height ?? undefined}
                loading={i < 3 ? "eager" : "lazy"}
                decoding="async"
                className="block h-auto w-full transition-transform duration-700 group-hover:scale-[1.015]"
              />
            </button>
            {(p.title || p.description) && (
              <figcaption className="mt-2.5 px-0.5">
                {p.title && <p className="font-serif text-lg leading-snug">{p.title}</p>}
                {p.description && <p className="mt-0.5 text-sm whitespace-pre-line text-muted">{p.description}</p>}
              </figcaption>
            )}
          </figure>
            ))}
          </div>
        ))}
      </div>

      <dialog
        ref={dlg}
        onClose={() => setAt(null)}
        onClick={(e) => e.target === e.currentTarget && setAt(null)}
        onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (x0.current === null) return;
          const dx = e.changedTouches[0].clientX - x0.current;
          if (Math.abs(dx) > 40) setAt((i) => (i! + (dx < 0 ? 1 : -1) + items.length) % items.length);
          x0.current = null;
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/90"
      >
        {open && (
          <div className="relative grid h-full w-full place-items-center px-4 py-16" onClick={(e) => e.target === e.currentTarget && setAt(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.src} alt={open.title ?? "Work by Max Gross"} className="max-h-full max-w-full rounded object-contain" />
            <button type="button" onClick={() => setAt(null)} className="absolute top-3 right-3 px-3 py-2 text-sm text-white/85 hover:text-white">
              Close
            </button>
            {items.length > 1 && (
              <>
                <button type="button" aria-label="Previous" onClick={() => setAt((i) => (i! - 1 + items.length) % items.length)} className="absolute top-1/2 left-1 -translate-y-1/2 px-3 py-4 text-3xl text-white/80 hover:text-white">‹</button>
                <button type="button" aria-label="Next" onClick={() => setAt((i) => (i! + 1) % items.length)} className="absolute top-1/2 right-1 -translate-y-1/2 px-3 py-4 text-3xl text-white/80 hover:text-white">›</button>
              </>
            )}
            {(open.title || open.description) && (
              <p className="absolute inset-x-0 bottom-4 px-4 text-center text-sm text-white/80">{[open.title, open.description].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
