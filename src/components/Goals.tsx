"use client";

import { useTransition, useRef } from "react";
import { bumpGoal, setGoalStatus, saveGoal } from "@/app/actions";

export type Goal = { id: string; title: string; metric: string | null; target: number | null; current: number; status: string; due_date?: string | null };

export function GoalBar({ goal, compact = false }: { goal: Goal; compact?: boolean }) {
  const [pending, start] = useTransition();
  const target = goal.target ? Number(goal.target) : null;
  const current = Number(goal.current);
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const achieved = goal.status === "achieved";

  return (
    <div className={pending ? "opacity-50" : ""}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={achieved ? "text-muted line-through decoration-line" : ""}>{goal.title}</span>
        {goal.metric && (
          <span className="shrink-0 text-muted tabular-nums">
            {current}{target != null ? ` / ${target}` : ""} {compact ? "" : goal.metric}
          </span>
        )}
      </div>
      {target != null && (
        <div className="mt-1.5 h-[2px] overflow-hidden bg-line" role="progressbar" aria-valuenow={current} aria-valuemin={0} aria-valuemax={target} aria-label={goal.title}>
          <div className={`h-full rounded-full ${achieved ? "bg-muted" : "bg-ink"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {goal.metric && (
            <>
              <button className="btn-quiet" aria-label={`Decrease ${goal.title}`} onClick={() => start(() => bumpGoal(goal.id, -1))}>−1</button>
              <button className="btn-quiet !border-ink !text-ink" aria-label={`Increase ${goal.title}`} onClick={() => start(() => bumpGoal(goal.id, 1))}>+1</button>
            </>
          )}
          {goal.due_date && <span className="text-xs text-muted">by {goal.due_date}</span>}
          <span className="flex-1" />
          {goal.status === "active" ? (
            <>
              <button className="text-xs text-muted hover:text-ink" onClick={() => start(() => setGoalStatus(goal.id, "achieved"))}>Mark achieved</button>
              <button className="text-xs text-muted hover:text-danger" onClick={() => start(() => setGoalStatus(goal.id, "dropped"))}>Drop</button>
            </>
          ) : (
            <button className="text-xs text-muted hover:text-ink" onClick={() => start(() => setGoalStatus(goal.id, "active"))}>Reopen</button>
          )}
        </div>
      )}
    </div>
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
      className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input name="title" required placeholder="New goal" aria-label="Goal" className="field col-span-2" />
      <input name="metric" placeholder="Measured in… (e.g. gigs)" aria-label="Metric" className="field col-span-2 sm:col-span-1" />
      <input name="target" type="number" step="any" placeholder="Target" aria-label="Target" className="field" />
      <input name="due_date" type="date" aria-label="Due date" className="field col-span-1 sm:col-span-2" />
      <button className="btn col-span-2 justify-center sm:col-span-2">Add goal</button>
    </form>
  );
}
