"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addProjectTask, moveTask, deleteTask, renameTask, setTaskStatus, setTaskProject, type Lane } from "@/app/actions";
import { RemoveX } from "./RemoveX";

const UNDATED = "9999-12-31";

export type ListTask = { id: string; title: string; status: string; day: string | null; project_id: string | null };
type Project = { id: string; title: string };
type Group = "today" | "scheduled" | "next" | "later" | "done";

const GROUPS: { id: Group; title: string; addTo?: Lane }[] = [
  { id: "today", title: "Today", addTo: "today" },
  { id: "scheduled", title: "Coming up" },
  { id: "next", title: "Up next", addTo: "next" },
  { id: "later", title: "Later", addTo: "later" },
  { id: "done", title: "Done" },
];

function groupOf(t: ListTask, today: string): Group {
  if (t.status === "done") return "done";
  if (!t.day) return "later";
  if (t.day === UNDATED) return "next";
  return t.day <= today ? "today" : "scheduled";
}

const dayLabel = (day: string, today: string) => {
  const d = new Date(day + "T12:00:00Z");
  const diff = Math.round((d.getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400_000);
  if (diff < 0) return "carried over";
  return diff < 7 ? d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const pill = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`;

/** Every task in one running checklist: type and press Enter to keep adding, like a Notes list. */
export function TaskList({ tasks: initial, projects, today, filter }: { tasks: ListTask[]; projects: Project[]; today: string; filter: string | null }) {
  const [tasks, setTasks] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  const projName = new Map(projects.map((p) => [p.id, p.title]));
  const shown = filter ? tasks.filter((t) => t.project_id === filter) : tasks;

  function move(id: string, lane: Lane) {
    setOpen(null);
    setTasks((ts) => ts.map((t) => (t.id !== id ? t : lane === "done" ? { ...t, status: "done" } : { ...t, status: "todo", day: lane === "later" ? null : lane === "today" ? today : UNDATED })));
    start(() => moveTask(id, lane));
  }

  return (
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const list = shown.filter((t) => groupOf(t, today) === g.id);
        if (!list.length && !g.addTo) return null;
        return (
          <section key={g.id} aria-label={g.title}>
            <h2 className="section-title">{g.title.toLowerCase()}</h2>
            <ul className="mt-1">
              {list.map((t) => {
                const done = t.status === "done";
                const meta = [t.day && t.day !== UNDATED && (g.id === "scheduled" || t.day < today) ? dayLabel(t.day, today) : null, t.project_id ? projName.get(t.project_id) : null].filter(Boolean).join(", ");
                return (
                  <li key={t.id} className="group border-b border-line py-1.5">
                    <div className="flex items-center gap-3">
                      <button
                        aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                        onClick={() => {
                          setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: done ? "todo" : "done" } : x)));
                          start(() => setTaskStatus(t.id, done ? "todo" : "done"));
                        }}
                        className={`ring-check grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
                      >
                        {done && (
                          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                            <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <Title
                          task={t}
                          done={done}
                          onFocus={() => setOpen(t.id)}
                          onRename={(title) => {
                            setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, title } : x)));
                            start(() => renameTask(t.id, title));
                          }}
                        />
                        {meta && <p className="text-xs text-muted">{meta}</p>}
                      </div>
                      <RemoveX
                        label={`Delete ${t.title}`}
                        className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        action={() => {
                          setTasks((ts) => ts.filter((x) => x.id !== t.id));
                          return deleteTask(t.id);
                        }}
                      />
                    </div>
                    {open === t.id && !done && (
                      <div className="mt-2 space-y-1 pl-8">
                        <div className="flex flex-wrap items-center gap-1">
                          {(["today", "next", "later"] as const).map((l) => (
                            <button key={l} type="button" onClick={() => move(t.id, l)} className={pill(groupOf(t, today) === l)}>
                              {l === "today" ? "Today" : l === "next" ? "Up next" : "Later"}
                            </button>
                          ))}
                        </div>
                        {projects.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {projects.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  const next = t.project_id === p.id ? null : p.id;
                                  setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, project_id: next } : x)));
                                  start(() => setTaskProject(t.id, next));
                                }}
                                className={pill(t.project_id === p.id)}
                              >
                                {p.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {g.addTo && (
                <QuickAdd
                  onAdd={(title) => {
                    const temp = { id: `new-${crypto.randomUUID()}`, title, status: "todo", day: g.addTo === "later" ? null : g.addTo === "today" ? today : UNDATED, project_id: filter };
                    setTasks((ts) => [...ts, temp]);
                    start(() => addProjectTask(filter, title, g.addTo!));
                  }}
                />
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The empty line at the end of a list: type, Enter, and the next empty line is ready. */
function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-dashed border-line" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const t = value.trim();
          if (!t) return;
          onAdd(t);
          setValue("");
          ref.current?.focus();
        }}
        onBlur={() => {
          const t = value.trim();
          if (t) {
            onAdd(t);
            setValue("");
          }
        }}
        placeholder="Add an action"
        aria-label="Add an action"
        className="min-w-0 flex-1 bg-transparent py-0.5 placeholder:text-muted/70 focus:outline-none"
      />
    </li>
  );
}

function Title({ task, done, onFocus, onRename }: { task: ListTask; done: boolean; onFocus: () => void; onRename: (title: string) => void }) {
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
      className={`w-full bg-transparent focus:outline-none ${done ? "text-muted line-through decoration-line" : ""}`}
    />
  );
}
