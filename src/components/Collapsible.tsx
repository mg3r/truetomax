"use client";

import { useEffect, useState } from "react";

/** A section you can fold away; it remembers on this device whether you left it open. */
export function Collapsible({ id, title, count, action, children }: { id: string; title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(`fold:${id}`) === "closed") setOpen(false);
    } catch {}
  }, [id]);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(`fold:${id}`, o ? "closed" : "open");
      } catch {}
      return !o;
    });
  };
  return (
    <section aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={`${id}-body`} className="group flex items-baseline gap-2 text-left">
          <h2 id={id} className="section-title group-hover:text-ink">{title}</h2>
          {!open && count ? <span className="text-xs text-muted tabular-nums">{count}</span> : null}
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" className={`self-center text-muted transition-transform ${open ? "rotate-90" : ""}`}>
            <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && action}
      </div>
      {open && <div id={`${id}-body`}>{children}</div>}
    </section>
  );
}
