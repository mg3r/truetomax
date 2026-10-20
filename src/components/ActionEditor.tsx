"use client";

import { useState, useTransition } from "react";
import { editTask, moveTask, setTaskProject, setTaskPractice, type Lane } from "@/app/actions";
import { PickOne } from "./PickOne";

const UNDATED = "9999-12-31";

export type EditableAction = {
  id: string;
  day: string | null;
  status: string;
  part_of_day?: string | null;
  at_time?: string | null;
  project_id?: string | null;
  routine_id?: string | null;
};

const PARTS = [
  { value: null, label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

const pill = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`;
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
 * when in the day, where it sits (Today / Up next / Later), its project, and its practice.
 * Every change saves right away; `onChange` lets the list update instantly.
 */
export function ActionEditor({
  action,
  today,
  projects,
  practices,
  onChange,
  onClose,
  showWhere = true,
}: {
  action: EditableAction;
  today: string;
  projects: { id: string; title: string }[];
  practices: { id: string; name: string }[];
  onChange: (patch: Partial<EditableAction>) => void;
  onClose: () => void;
  showWhere?: boolean;
}) {
  const [, start] = useTransition();
  const [time, setTime] = useState(action.at_time?.slice(0, 5) ?? "");
  const lane = laneOfAction(action, today);
  const dated = action.day && action.day !== UNDATED && action.day > today;

  const setWhen = (part: string | null, at: string | null) => {
    onChange({ part_of_day: part, at_time: at });
    start(() => editTask(action.id, { part_of_day: part, at_time: at }));
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="When in the day">
        {PARTS.map((p) => {
          const on = (action.part_of_day ?? null) === p.value && !action.at_time;
          return (
            <button key={p.label} type="button" onClick={() => { setTime(""); setWhen(p.value, null); }} className={pill(on)}>
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
          className={`rounded-full border bg-transparent px-2.5 py-0.5 text-xs ${time ? "border-ink text-ink" : "border-line text-muted"}`}
        />
      </div>

      {showWhere && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Where it sits">
          {(["today", "next", "later"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                if (l === lane && !dated) return;
                onChange({ status: "todo", day: l === "later" ? null : l === "today" ? today : UNDATED });
                start(() => moveTask(action.id, l));
              }}
              className={pill(lane === l && !(l === "next" && dated))}
            >
              {l === "today" ? "Today" : l === "next" ? "Up next" : "Later"}
            </button>
          ))}
        </div>
      )}

      <PickOne
        label="Project"
        options={projects.map((p) => ({ id: p.id, name: p.title }))}
        value={action.project_id}
        onChange={(next) => {
          onChange({ project_id: next });
          start(() => setTaskProject(action.id, next));
        }}
      />
      <PickOne
        label="Practice"
        options={practices}
        value={action.routine_id}
        onChange={(next) => {
          onChange({ routine_id: next });
          start(() => setTaskPractice(action.id, next));
        }}
      />

      <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">
        Done
      </button>
    </div>
  );
}
