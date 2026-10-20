"use client";

import { useTransition } from "react";
import { notify } from "./Toaster";

const base = "grid h-9 w-9 place-items-center rounded-full border border-line text-muted disabled:opacity-40";

/** A round + that keeps something (an idea becomes a project in review, or a post idea goes to Up next). */
export function PlusButton({ action, label, done }: { action: () => Promise<void>; label: string; done?: { text: string; href: string; link: string } }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action();
          if (done) notify(done.text, done.href, done.link);
        })
      } className={`${base} hover:border-ink hover:text-ink`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** A round trash can that removes something after you confirm. */
export function TrashButton({ action, label, confirm: question }: { action: () => Promise<void>; label: string; confirm: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(question)) return;
        start(() => action());
      }}
      className={`${base} hover:border-danger hover:text-danger`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 4h9M5.5 4V2.75h3V4M3.75 4l.6 7.5a1 1 0 0 0 1 .9h3.3a1 1 0 0 0 1-.9l.6-7.5M6 6.25v4M8 6.25v4" />
      </svg>
    </button>
  );
}
