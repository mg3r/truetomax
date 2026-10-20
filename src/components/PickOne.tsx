"use client";

import { useState } from "react";

/**
 * A quiet "Practice" or "Project" button that opens its choices only when you tap it.
 * Shows the chosen one by name; pick it again (or "None") to clear.
 */
export function PickOne({
  label,
  options,
  value,
  onChange,
  size = "sm",
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  if (!options.length) return null;
  const chosen = options.find((o) => o.id === value);
  const base = size === "md" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  const pill = (on: boolean) => `rounded-full border ${base} ${on ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} (optional)`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={pill(!!chosen)}>
        {chosen ? `${label}: ${chosen.name}` : label}
      </button>
      {open && (
        <>
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={o.id === value}
              onClick={() => {
                onChange(o.id === value ? null : o.id);
                setOpen(false);
              }}
              className={`rounded-full border ${base} ${o.id === value ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {o.name}
            </button>
          ))}
          {chosen && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`rounded-full border border-transparent ${base} text-muted hover:text-ink`}
            >
              None
            </button>
          )}
        </>
      )}
    </div>
  );
}
