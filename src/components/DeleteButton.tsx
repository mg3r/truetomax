"use client";

import { useTransition } from "react";

export function DeleteButton({ action, label = "Delete", confirm: question }: { action: () => Promise<void>; label?: string; confirm?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-xs text-muted hover:text-danger"
      disabled={pending}
      onClick={() => {
        if (question && !window.confirm(question)) return;
        start(() => action());
      }}
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}

export function ActionButton({ action, children, className = "btn-quiet" }: { action: () => Promise<void>; children: React.ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button className={className} disabled={pending} onClick={() => start(() => action())}>
      {children}
    </button>
  );
}
