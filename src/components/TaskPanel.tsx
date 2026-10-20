"use client";

import { useEffect, useState, useTransition } from "react";
import { addProjectTask, moveTask, deleteTask, renameTask, setUpNextDay, type Lane } from "@/app/actions";
import { Board, LANES, laneOf, type BoardTask } from "./Board";
import { RemoveX } from "./RemoveX";

const VIEW_KEY = "ttm-project-view";
const UNDATED = "9999-12-31";

/** The next seven days, starting tomorrow, as Mon, Tue… */
function comingDays(today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i + 1);
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) };
  });
}
const dayLabel = (day: string | null) =>
  day && day !== UNDATED ? new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", ...(Date.parse(day) - Date.now() > 6 * 86400_000 ? { month: "short", day: "numeric" } : {}), timeZone: "UTC" }) : null;

/** Optional day for an Up next task: none, or one of the coming week's days. */
function DayPick({ value, today, onPick }: { value: string | null; today: string; onPick: (day: string | null) => void }) {
  const pill = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`;
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Day (optional)">
      {comingDays(today).map((d) => (
        <button key={d.date} type="button" aria-pressed={value === d.date} onClick={() => onPick(value === d.date ? null : d.date)} className={pill(value === d.date)}>
          {d.label}
        </button>
      ))}
    </div>
  );
}

/** A project's tasks: one place to add (choosing where it goes), shown as a list or a board. */
export function TaskPanel({ projectId, tasks: initial, today }: { projectId: string; tasks: BoardTask[]; today: string }) {
  const [tasks, setTasks] = useState(initial);
  const [view, setView] = useState<"list" | "board">("list");
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<Lane>("today");
  const [nextDay, setNextDay] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setTasks(initial);
  }, [initial]);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "board" || v === "list") setView(v);
    } catch {}
  }, []);
  function choose(v: "list" | "board") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  }

  function move(id: string, to: Lane) {
    setOpen(null);
    setTasks((ts) =>
      ts.map((t) =>
        t.id !== id ? t : to === "done" ? { ...t, status: "done" } : { ...t, status: "todo", day: to === "later" ? null : to === "today" ? today : t.day && t.day > today ? t.day : UNDATED }
      )
    );
    start(() => moveTask(id, to));
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (!t) return;
          setTitle("");
          start(() => addProjectTask(projectId, t, lane, lane === "next" ? nextDay : null));
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task"
            aria-label="New task"
            className="field min-w-0 flex-1"
          />
          <button className="btn" disabled={!title.trim()}>Add</button>
        </div>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">When</legend>
          {LANES.map((l) => (
            <label key={l.id} className="cursor-pointer">
              <input type="radio" name="lane" value={l.id} checked={lane === l.id} onChange={() => setLane(l.id)} className="peer sr-only" />
              <span className="btn-quiet !px-3 !py-1 text-xs peer-checked:!border-ink peer-checked:!bg-ink peer-checked:!text-bg peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2">
                {l.title}
              </span>
            </label>
          ))}
        </fieldset>
        {lane === "next" && <DayPick value={nextDay} today={today} onPick={setNextDay} />}
      </form>

      <div className="mt-8 flex items-baseline justify-end gap-3 text-sm" role="tablist" aria-label="View">
        {(["list", "board"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => choose(v)} className={view === v ? "text-ink underline decoration-line underline-offset-4" : "text-muted hover:text-ink"}>
            {v === "list" ? "List" : "Board"}
          </button>
        ))}
      </div>

      {view === "board" ? (
        <div className="mt-3">
          <Board tasks={tasks} today={today} />
        </div>
      ) : (
        <div className={`mt-3 space-y-6 ${pending ? "opacity-80" : ""}`}>
          {LANES.map((l) => {
            const mine = tasks.filter((t) => laneOf(t, today) === l.id);
            if (!mine.length) return null;
            return (
              <section key={l.id} aria-label={l.title}>
                <h3 className="section-title">{l.title.toLowerCase()}</h3>
                <ul className="mt-1 divide-y divide-line">
                  {mine.map((t) => {
                    const done = t.status === "done";
                    return (
                      <li key={t.id} className="py-1.5">
                        <div className="flex items-center gap-3">
                          <button
                            aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                            onClick={() => move(t.id, done ? "today" : "done")}
                            className={`ring-check grid h-5 w-5 shrink-0 place-items-center border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
                          >
                            {done && (
                              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                                <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <TitleInput
                            task={t}
                            done={done}
                            onFocus={() => setOpen(t.id)}
                            onRename={(title) => {
                              setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, title } : x)));
                              start(() => renameTask(t.id, title));
                            }}
                          />
                          {l.id === "next" && dayLabel(t.day) && <span className="shrink-0 text-xs text-muted">{dayLabel(t.day)}</span>}
                          <RemoveX
                            label={`Delete ${t.title}`}
                            action={() => {
                              setTasks((ts) => ts.filter((x) => x.id !== t.id));
                              return deleteTask(t.id);
                            }}
                          />
                        </div>
                        {open === t.id && l.id === "next" && (
                          <div className="mt-2 pl-8">
                            <DayPick
                              value={t.day}
                              today={today}
                              onPick={(d) => {
                                setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, day: d ?? UNDATED } : x)));
                                start(() => setUpNextDay(t.id, d));
                              }}
                            />
                          </div>
                        )}
                        {open === t.id && (
                          <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                            {LANES.filter((x) => x.id !== l.id && x.id !== "done").map((x) => (
                              <button key={x.id} className="btn-quiet !px-2.5 !py-1 text-xs" onClick={() => move(t.id, x.id)}>
                                Move to {x.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!tasks.length && <p className="text-sm text-muted">No tasks yet. Add the next step above.</p>}
        </div>
      )}
    </div>
  );
}

/** The task's text, editable in place. Focusing it also shows where it can move. */
function TitleInput({ task, done, onFocus, onRename }: { task: BoardTask; done: boolean; onFocus: () => void; onRename: (title: string) => void }) {
  const [value, setValue] = useState(task.title);
  useEffect(() => {
    setValue(task.title);
  }, [task.title]);
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={onFocus}
      onBlur={() => {
        if (!value.trim()) return setValue(task.title);
        if (value !== task.title) onRename(value.trim());
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label="Task"
      className={`min-w-0 flex-1 bg-transparent focus:outline-none ${done ? "text-muted line-through decoration-line" : ""}`}
    />
  );
}
