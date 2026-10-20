"use client";

import { useEffect, useState, useTransition } from "react";
import { editRhythm, deleteRhythm, editTask, deleteTask, setTaskStatus } from "@/app/actions";
import { RemoveX } from "./RemoveX";
import { LineEdit } from "./LineEdit";

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

/**
 * One line on the Schedule you edit where it sits: tap the words to rename, tap the time to move it.
 * "rhythm" repeats every week; "task" is a one-time task on its date (the same task Today shows), with a box to tick.
 */
export function ScheduleItem({
  item,
  kind = "rhythm",
  project,
  done = false,
  calendar,
}: {
  item: RhythmItem;
  kind?: "rhythm" | "task";
  project?: string | null;
  done?: boolean;
  /** The matching Google Calendar event, if it's also there: its time is used when this has none of its own. */
  calendar?: { link?: string; label: string } | null;
}) {
  const [title, setTitle] = useState(item.title);
  const [part, setPart] = useState(item.part_of_day);
  const [time, setTime] = useState(item.at_time?.slice(0, 5) ?? "");
  const [open, setOpen] = useState(false);
  const [isDone, setDone] = useState(done);
  const [, start] = useTransition();

  useEffect(() => {
    setTitle(item.title);
    setPart(item.part_of_day);
    setTime(item.at_time?.slice(0, 5) ?? "");
  }, [item.title, item.part_of_day, item.at_time]);
  useEffect(() => {
    setDone(done);
  }, [done]);

  const label = time ? clock(time) : calendar ? calendar.label : part ?? "anytime";
  const edit = kind === "task" ? editTask : editRhythm;
  const save = (fields: Parameters<typeof editRhythm>[1]) => start(() => edit(item.id, fields));
  const meta = [kind === "rhythm" ? "weekly" : null, project].filter(Boolean).join(", ");

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
        {kind === "task" && (
          <button
            aria-label={isDone ? `Mark "${title}" not done` : `Mark "${title}" done`}
            onClick={() => {
              const next = !isDone;
              setDone(next);
              start(() => setTaskStatus(item.id, next ? "done" : "todo"));
            }}
            className={`ring-check grid h-4 w-4 shrink-0 place-items-center border ${isDone ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
          >
            {isDone && (
              <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <LineEdit
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (!title.trim()) return setTitle(item.title);
              if (title !== item.title) save({ title });
            }}
            aria-label="What"
            className={`w-full bg-transparent focus:outline-none ${isDone ? "text-muted line-through decoration-line" : ""}`}
          />
          {(meta || calendar) && (
            <p className="text-xs text-muted">
              {meta}
              {calendar && (
                <>
                  {meta ? ", " : ""}
                  {calendar.link ? (
                    <a href={calendar.link} target="_blank" rel="noopener noreferrer" className="hover:text-ink hover:underline">in your calendar</a>
                  ) : (
                    "in your calendar"
                  )}
                </>
              )}
            </p>
          )}
        </div>
        <RemoveX
          label={`Remove ${item.title}`}
          action={() => (kind === "task" ? deleteTask(item.id) : deleteRhythm(item.id))}
          className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        />
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
