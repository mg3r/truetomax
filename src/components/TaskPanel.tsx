"use client";

import { useEffect, useState, useTransition } from "react";
import { addProjectTask, moveTask, deleteTask, renameTask, type Lane } from "@/app/actions";
import { ActionEditor } from "./ActionEditor";
import { Board, LANES, laneOf, type BoardTask } from "./Board";
import { RemoveX } from "./RemoveX";
import { LineEdit } from "./LineEdit";

const VIEW_KEY = "ttm-project-view";
const UNDATED = "9999-12-31";

/** A project's tasks: one place to add (choosing where it goes), shown as a list or a board. */
export function TaskPanel({ projectId, tasks: initial, today, practices = [] }: { projectId: string; tasks: BoardTask[]; today: string; practices?: { id: string; name: string }[] }) {
  const [tasks, setTasks] = useState(initial);
  const [view, setView] = useState<"list" | "board">("list");
  const [title, setTitle] = useState("");
  const [lane, setLane] = useState<Lane>("today");
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
        t.id !== id ? t : to === "done" ? { ...t, status: "done" } : { ...t, status: "todo", day: to === "later" ? null : to === "today" ? today : UNDATED }
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
          start(() => addProjectTask(projectId, t, lane));
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add an action"
            aria-label="New action"
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
                        <div className="flex items-start gap-3">
                          <button
                            aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                            onClick={() => move(t.id, done ? "today" : "done")}
                            className={`ring-check mt-0.5 grid h-5 w-5 shrink-0 place-items-center border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
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
                          <RemoveX
                            label={`Delete ${t.title}`}
                            action={() => {
                              setTasks((ts) => ts.filter((x) => x.id !== t.id));
                              return deleteTask(t.id);
                            }}
                          />
                        </div>
                        {open === t.id && (
                          <div className="pl-8">
                            <ActionEditor
                              action={t}
                              today={today}
                              projects={[]}
                              practices={practices}
                              onChange={(patch) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))}
                              onClose={() => setOpen(null)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!tasks.length && <p className="text-sm text-muted">No actions yet. Add the next step above.</p>}
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
    <LineEdit
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={onFocus}
      onBlur={() => {
        if (!value.trim()) return setValue(task.title);
        if (value !== task.title) onRename(value.trim());
      }}
      aria-label="Action"
      className={`min-w-0 flex-1 bg-transparent focus:outline-none ${done ? "text-muted line-through decoration-line" : ""}`}
    />
  );
}
