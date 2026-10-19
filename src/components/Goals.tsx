"use client";

import { useTransition, useRef, useState } from "react";
import { setGoalStatus, saveGoal, setGoalCurrent } from "@/app/actions";

export type Goal = { id: string; title: string; metric: string | null; target: number | null; current: number; status: string; due_date?: string | null };

/** A goal is an outcome you tick off when it's true. A number shows only if you chose to track one. */
export function GoalRow({ goal }: { goal: Goal }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(String(Number(goal.current)));
  const achieved = goal.status === "achieved";
  const target = goal.target == null ? null : Number(goal.target);

  return (
    <li className={`group flex items-start gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <button
        aria-label={achieved ? `Mark "${goal.title}" not achieved` : `Mark "${goal.title}" achieved`}
        onClick={() => start(() => setGoalStatus(goal.id, achieved ? "active" : "achieved"))}
        className={`ring-check mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${achieved ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
      >
        {achieved && (
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={achieved ? "text-muted line-through decoration-line" : ""}>{goal.title}</p>
        {target != null && !achieved && (
          <form
            className="mt-1 flex items-center gap-1.5 text-sm text-muted"
            onSubmit={(e) => {
              e.preventDefault();
              start(() => setGoalCurrent(goal.id, Number(current)));
            }}
          >
            <input
              type="number"
              min={0}
              step="any"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onBlur={() => Number(current) !== Number(goal.current) && start(() => setGoalCurrent(goal.id, Number(current)))}
              aria-label={`Progress on ${goal.title}`}
              className="w-12 border-b border-line bg-transparent text-center text-ink tabular-nums focus:border-ink focus:outline-none"
            />
            <span>of {target}{goal.metric ? ` ${goal.metric}` : ""}</span>
          </form>
        )}
      </div>
      <button
        onClick={() => start(() => setGoalStatus(goal.id, "dropped"))}
        className="text-xs text-muted opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      >
        Remove
      </button>
    </li>
  );
}

export function AddGoal({ projectId }: { projectId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await saveGoal(fd);
        ref.current?.reset();
      }}
      className="mt-2 space-y-2"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <div className="flex gap-2">
        <input name="title" required placeholder='Add a goal, e.g. "First paid dinner hosted"' aria-label="Goal" className="field min-w-0 flex-1" />
        <button className="btn">Add</button>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-muted hover:text-ink">Track a number too (optional)</summary>
        <div className="mt-2 flex gap-2">
          <input name="target" type="number" step="any" min={0} placeholder="How many" aria-label="Target number" className="field w-28" />
          <input name="metric" placeholder="of what (e.g. gigs)" aria-label="Unit" className="field min-w-0 flex-1" />
        </div>
      </details>
    </form>
  );
}
