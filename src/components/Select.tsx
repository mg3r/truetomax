"use client";

import { useEffect, useId, useRef, useState } from "react";

export type Option = { value: string; label: string };

/**
 * A dropdown in the app's own style. Works inside plain forms: the chosen value is
 * submitted under `name`, and the form's reset puts it back to the default.
 */
export function Select({
  name,
  options,
  defaultValue = "",
  label,
  className = "",
  onChange,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  label: string;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  // Follow the form's reset.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setValue(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(v: string) {
    setValue(v);
    setOpen(false);
    onChange?.(v);
  }

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      return openList();
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-label={label}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 border-b border-line py-[0.55rem] pr-1 pl-0.5 text-left hover:border-ink focus-visible:border-ink"
      >
        <span className={`truncate ${value ? "" : "text-muted"}`}>{current?.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="pebble-alt absolute left-0 z-30 mt-2 max-h-72 min-w-full overflow-auto border border-line bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
              className={`flex cursor-pointer items-center justify-between gap-4 rounded-[14px] px-3 py-2 whitespace-nowrap ${i === active ? "bg-faint" : ""}`}
            >
              {o.label}
              {o.value === value && (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
