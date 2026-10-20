"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useClickAway } from "@/lib/useClickAway";
import { editTask, moveTask, setTaskProjects, setTaskPractices, type Lane } from "@/app/actions";
import { PickMany } from "./PickMany";
import { Grow } from "./Grow";
import { projectsOf, practicesOf } from "@/lib/links";

const UNDATED = "9999-12-31";

export type EditableAction = {
  id: string;
  day: string | null;
  status: string;
  part_of_day?: string | null;
  at_time?: string | null;
  project_id?: string | null;
  routine_id?: string | null;
  project_ids?: string[] | null;
  routine_ids?: string[] | null;
  reason?: string | null;
};

const PARTS = [
  { value: null, label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

const chip = (on: boolean) => `rounded-full border px-2.5 py-1 ${on ? "border-ink text-ink" : "border-line text-muted hover:text-ink"}`;
const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** A label and its value on one quiet line; tap to show the choices underneath. */
function Property({ label, value, open, onToggle, children }: { label: string; value: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="text-xs">
      <button type="button" aria-expanded={open} onClick={onToggle} className="group grid w-full grid-cols-[4.5rem_1fr] items-baseline gap-2 text-left">
        <span className="text-muted">{label}</span>
        <span className="text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">{value}</span>
      </button>
      {open && <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-[5rem]">{children}</div>}
    </div>
  );
}
const partForTime = (t: string) => {
  const h = Number(t.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
};

export function laneOfAction(a: EditableAction, today: string): Lane {
  if (a.status === "done") return "done";
  if (!a.day) return "later";
  if (a.day === UNDATED) return "next";
  return a.day <= today ? "today" : "next";
}

/**
 * The one editor for an action, wherever you tap it (Actions, a project, Schedule):
 * when in the day, where it sits (Today / Up next / Later), its projects, and its practices (as many as fit).
 * Every change saves right away; `onChange` lets the list update instantly. Tap outside to close.
 */
export function ActionEditor({
  action,
  today,
  projects,
  practices,
  onChange,
  onClose,
  showWhere = true,
  showNotes = true,
}: {
  action: EditableAction;
  today: string;
  projects: { id: string; title: string }[];
  practices: { id: string; name: string }[];
  onChange: (patch: Partial<EditableAction>) => void;
  onClose: () => void;
  showWhere?: boolean;
  /** Off where the notes are already shown above (partner suggestions). */
  showNotes?: boolean;
}) {
  const [, start] = useTransition();
  // Tap anywhere outside the action's row (or press Escape) to close; every change has already saved.
  const box = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLElement | null>(null);
  useEffect(() => {
    row.current = box.current?.closest("li") ?? box.current;
  }, []);
  useClickAway(row, true, onClose);
  const [time, setTime] = useState(action.at_time?.slice(0, 5) ?? "");
  const [notes, setNotes] = useState(action.reason ?? "");
  const [editing, setEditing] = useState<"when" | "where" | null>(null);
  const whenLabel = action.at_time ? clock(action.at_time) : PARTS.find((p) => p.value === (action.part_of_day ?? null))?.label ?? "Anytime";
  const lane = laneOfAction(action, today);
  const dated = action.day && action.day !== UNDATED && action.day > today;

  const setWhen = (part: string | null, at: string | null) => {
    onChange({ part_of_day: part, at_time: at });
    start(() => editTask(action.id, { part_of_day: part, at_time: at }));
  };

  return (
    <div ref={box} className="mt-3 mb-2 space-y-3">
      {/* When and Where read as quiet property lines, like Project and Practice; tap one to change it. */}
      <Property label="When" value={whenLabel} open={editing === "when"} onToggle={() => setEditing((e) => (e === "when" ? null : "when"))}>
        {PARTS.map((p) => {
          const on = (action.part_of_day ?? null) === p.value && !action.at_time;
          return (
            <button key={p.label} type="button" onClick={() => { setTime(""); setWhen(p.value, null); setEditing(null); }} className={chip(on)}>
              {p.label}
            </button>
          );
        })}
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => {
            if (time === (action.at_time?.slice(0, 5) ?? "")) return;
            setWhen(time ? partForTime(time) : action.part_of_day ?? null, time || null);
          }}
          aria-label="Exact time (optional)"
          className={`rounded-full border bg-transparent px-2.5 py-0.5 ${time ? "border-ink text-ink" : "border-line text-muted"}`}
        />
      </Property>

      {showWhere && (
        <Property label="Where" value={lane === "today" ? "Today" : lane === "later" ? "Later" : dated ? "Coming up" : "Up next"} open={editing === "where"} onToggle={() => setEditing((e) => (e === "where" ? null : "where"))}>
          {(["today", "next", "later"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setEditing(null);
                if (l === lane && !dated) return;
                onChange({ status: "todo", day: l === "later" ? null : l === "today" ? today : UNDATED });
                start(() => moveTask(action.id, l));
              }}
              className={chip(lane === l && !(l === "next" && dated))}
            >
              {l === "today" ? "Today" : l === "next" ? "Up next" : "Later"}
            </button>
          ))}
        </Property>
      )}

      <PickMany
        label="Project"
        empty={
          <>
            <span className="inline-block w-[4.5rem] pr-2 text-muted">Project</span>None in progress yet.{" "}
            <Link href="/projects" className="underline decoration-line underline-offset-4 hover:text-ink">Drag one to In progress</Link> to add actions to it.
          </>
        }
        options={projects.map((p) => ({ id: p.id, name: p.title }))}
        value={projectsOf(action)}
        onChange={(next) => {
          onChange({ project_id: next[0] ?? null, project_ids: next });
          start(() => setTaskProjects(action.id, next));
        }}
      />
      <PickMany
        label="Practice"
        options={practices}
        value={practicesOf(action)}
        onChange={(next) => {
          onChange({ routine_id: next[0] ?? null, routine_ids: next });
          start(() => setTaskPractices(action.id, next));
        }}
      />

      {showNotes && (
        <Grow
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes.trim() === (action.reason ?? "").trim()) return;
            onChange({ reason: notes.trim() || null });
            start(() => editTask(action.id, { notes }));
          }}
          placeholder="Add notes"
          aria-label="Notes"
          className="block w-full resize-none rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed text-ink/90 whitespace-pre-wrap placeholder:text-muted focus:outline-none"
        />
      )}
    </div>
  );
}
