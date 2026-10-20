"use client";

import { useEffect, useState, useTransition } from "react";
import { editRhythm, deleteRhythm } from "@/app/actions";
import { RemoveX } from "./RemoveX";

const PARTS = [
  { value: null, label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The part of day a time falls in. */
const partForTime = (t: string) => {
  const h = Number(t.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};

export type RhythmItem = { id: string; title: string; at_time: string | null; part_of_day: string | null };

/** A schedule item you edit where it sits: tap the words to rename, tap the time to move it. */
export function ScheduleItem({ item }: { item: RhythmItem }) {
  const [title, setTitle] = useState(item.title);
  const [part, setPart] = useState(item.part_of_day);
  const [time, setTime] = useState(item.at_time?.slice(0, 5) ?? "");
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    setTitle(item.title);
    setPart(item.part_of_day);
    setTime(item.at_time?.slice(0, 5) ?? "");
  }, [item.title, item.part_of_day, item.at_time]);

  const label = time ? clock(time) : part ?? "anytime";
  const save = (fields: Parameters<typeof editRhythm>[1]) => start(() => editRhythm(item.id, fields));

  return (
    <li className="group py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`When: ${label}. Change`}
          className={`w-24 shrink-0 text-left text-sm tabular-nums underline-offset-4 hover:text-ink hover:underline ${open ? "text-ink underline" : "text-muted"}`}
        >
          {label}
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!title.trim()) return setTitle(item.title);
            if (title !== item.title) save({ title });
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="What"
          className="min-w-0 flex-1 bg-transparent focus:outline-none"
        />
        <RemoveX label={`Remove ${item.title}`} action={() => deleteRhythm(item.id)} className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" />
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs sm:pl-[6.75rem]">
          {PARTS.map((p) => {
            const on = (part ?? null) === p.value && !time;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setPart(p.value);
                  setTime("");
                  save({ part_of_day: p.value, at_time: null });
                }}
                className={`rounded-full border px-2.5 py-1 ${on ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {p.label}
              </button>
            );
          })}
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => {
              if (time === (item.at_time?.slice(0, 5) ?? "")) return;
              const p = time ? partForTime(time) : part;
              setPart(p);
              save({ at_time: time || null, part_of_day: p });
            }}
            aria-label="Exact time (optional)"
            className={`rounded-full border bg-transparent px-2.5 py-0.5 ${time ? "border-ink text-ink" : "border-line text-muted"}`}
          />
          <button type="button" onClick={() => setOpen(false)} className="ml-1 text-muted hover:text-ink">
            Done
          </button>
        </div>
      )}
    </li>
  );
}
