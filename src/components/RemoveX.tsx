"use client";

import { useTransition } from "react";

/** A small × that removes something. Asks first only when a `confirm` question is given. */
export function RemoveX({ action, label, confirm: question, className = "" }: { action: () => Promise<void> | void; label: string; confirm?: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (question && !window.confirm(question)) return;
        start(async () => {
          await action();
        });
      }}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-line/50 hover:text-danger ${pending ? "opacity-40" : ""} ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
