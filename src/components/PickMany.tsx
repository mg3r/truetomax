"use client";

import { useState } from "react";

/**
 * A quiet "Practice" or "Project" button that opens its choices only when you tap it.
 * Pick as many as you like; tap one again to take it off. Shows the chosen ones by name.
 */
export function PickMany({
  label,
  options,
  value,
  onChange,
  size = "sm",
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  if (!options.length) return null;
  const chosen = options.filter((o) => value.includes(o.id));
  const base = size === "md" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  const pill = (on: boolean) => `rounded-full border ${base} ${on ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${label} (optional)`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={pill(chosen.length > 0)}>
        {chosen.length ? `${label}: ${chosen.map((c) => c.name).join(", ")}` : label}
      </button>
      {open &&
        options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
              className={`rounded-full border ${base} ${on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {on ? "✓ " : ""}
              {o.name}
            </button>
          );
        })}
    </div>
  );
}
