"use client";

import { useState } from "react";

/**
 * A quiet property line, like Notion: "Project   Cacao and movement evening" or "Practice   Add".
 * Tap it to see the choices; pick as many as you like, tap one again to take it off.
 */
export function PickMany({
  label,
  options,
  value,
  onChange,
  size = "sm",
  empty,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  size?: "sm" | "md";
  /** Shown when there's nothing to pick yet, so the option doesn't silently vanish. */
  empty?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const text = size === "md" ? "text-sm" : "text-xs";
  if (!options.length) return empty ? <p className={`${text} text-muted`}>{empty}</p> : null;
  const chosen = options.filter((o) => value.includes(o.id));

  return (
    <div role="group" aria-label={`${label} (optional)`} className={text}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="group grid w-full grid-cols-[4.5rem_1fr] items-baseline gap-2 text-left">
        <span className="text-muted">{label}</span>
        <span className={chosen.length ? "text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-4" : "text-muted group-hover:text-ink"}>
          {chosen.length ? chosen.map((c) => c.name).join(", ") : "Add"}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-[5rem]">
          {options.map((o) => {
            const on = value.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
                className={`rounded-full border px-2.5 py-1 ${on ? "border-ink text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {on ? "✓ " : ""}
                {o.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
