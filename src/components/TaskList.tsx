"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { projectsOf } from "@/lib/links";
import { addProjectTask, deleteTask, moveTask, renameTask, setTaskStatus, type Lane } from "@/app/actions";
import { RemoveX } from "./RemoveX";
import { ActionEditor } from "./ActionEditor";
import { LineEdit } from "./LineEdit";
import { useClickAway } from "@/lib/useClickAway";

const UNDATED = "9999-12-31";

export type ListTask = { reason?: string | null; id: string; title: string; status: string; day: string | null; project_id: string | null; routine_id?: string | null; project_ids?: string[] | null; routine_ids?: string[] | null; part_of_day?: string | null; at_time?: string | null };
type Project = { id: string; title: string };
type Group = "today" | "scheduled" | "next" | "later" | "done";

// Drag an action into Today, Up next, Later or Done to move it there (dropping in Done finishes it).
const GROUPS: { id: Group; title: string; addTo?: Lane; drop?: Lane; always?: boolean }[] = [
  { id: "today", title: "Today", addTo: "today", drop: "today" },
  { id: "scheduled", title: "Coming up" },
  { id: "next", title: "Up next", addTo: "next", drop: "next" },
  { id: "later", title: "Later", addTo: "later", drop: "later" },
  { id: "done", title: "Done", drop: "done", always: true },
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

const clock = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** Every action in one running checklist: type and press Enter to keep adding, like a Notes list. Drag by the dots to move one. */
export function TaskList({
  tasks: initial,
  projects,
  practices = [],
  today,
  filter,
  openId = null,
}: {
  tasks: ListTask[];
  projects: Project[];
  practices?: { id: string; name: string }[];
  today: string;
  filter: string | null;
  /** Opened from Today: this action starts open, scrolled into view. */
  openId?: string | null;
}) {
  const [tasks, setTasks] = useState(initial);
  const [open, setOpen] = useState<string | null>(openId);
  useEffect(() => {
    if (!openId) return;
    const el = document.getElementById(`action-${openId}`);
    el?.scrollIntoView({ block: "center" });
  }, [openId]);
  const [, start] = useTransition();
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  const shown = filter ? tasks.filter((t) => projectsOf(t).includes(filter)) : tasks;
  const [dragging, setDragging] = useState<string | null>(null);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const lane = e.over?.id as Lane | undefined;
    const t = tasks.find((x) => x.id === e.active.id);
    if (!lane || !t) return;
    const from = groupOf(t, today);
    if (from === lane) return;
    setOpen(null);
    setTasks((ts) =>
      ts.map((x) =>
        x.id !== t.id ? x : lane === "done" ? { ...x, status: "done" } : { ...x, status: "todo", day: lane === "later" ? null : lane === "today" ? today : UNDATED }
      )
    );
    start(() => moveTask(t.id, lane));
  }
  const lifted = tasks.find((t) => t.id === dragging);

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(e.active.id as string)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
    <div className="space-y-8">
      {GROUPS.map((g) => {
        const list = shown.filter((t) => groupOf(t, today) === g.id);
        if (!list.length && !g.addTo && !g.always) return null;
        return (
          <Lane key={g.id} id={g.drop} title={g.title} empty={g.id === "done" && !list.length ? "Drag an action here to finish it." : null}>
              {list.map((t) => {
                const done = t.status === "done";
                // Every open action says when in the day it is, Anytime included.
                const when = t.at_time ? clock(t.at_time) : t.part_of_day ?? "anytime";
                const meta = [t.day && t.day !== UNDATED && (g.id === "scheduled" || t.day < today) ? dayLabel(t.day, today) : null, done ? null : when].filter(Boolean).join(", ");
                return (
                  <Row key={t.id} id={t.id} open={open === t.id && (!done || !!t.reason)}>
                    <div className="flex items-start gap-3">
                      <button
                        aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                        onClick={() => {
                          setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: done ? "todo" : "done" } : x)));
                          start(() => setTaskStatus(t.id, done ? "todo" : "done"));
                        }}
                        className={`ring-check mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
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
                        {!(open === t.id && (!done || t.reason)) && (meta || t.reason) && (
                          <p className="flex items-center gap-1.5 text-xs text-muted">
                            {meta}
                            {/* A small mark when it carries notes (the details from a post idea, or your own); open it to read them. */}
                            {t.reason && (
                              <svg width="11" height="11" viewBox="0 0 12 12" aria-label="Has notes" role="img" className="shrink-0">
                                <path d="M2.5 3.5h7M2.5 6h7M2.5 8.5h4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                              </svg>
                            )}
                          </p>
                        )}
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
                    {/* A finished action still opens to show its notes. */}
                    {open === t.id && done && t.reason && <DoneNotes text={t.reason} onClose={() => setOpen(null)} />}
                    {open === t.id && !done && (
                      <div className="pl-8">
                        <ActionEditor
                          action={t}
                          today={today}
                          projects={projects}
                          practices={practices}
                          showWhere={false}
                          onChange={(patch) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x)))}
                          onClose={() => setOpen(null)}
                        />
                      </div>
                    )}
                  </Row>
                );
              })}
              {g.addTo && (
                <QuickAdd
                  onAdd={(title) => {
                    const temp = { id: `new-${crypto.randomUUID()}`, title, status: "todo", day: g.addTo === "later" ? null : g.addTo === "today" ? today : UNDATED, project_id: filter, project_ids: filter ? [filter] : [] };
                    setTasks((ts) => [...ts, temp]);
                    start(() => addProjectTask(filter, title, g.addTo!));
                  }}
                />
              )}
          </Lane>
        );
      })}
    </div>
      <DragOverlay dropAnimation={null}>
        {lifted ? <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">{lifted.title}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

function DoneNotes({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickAway(ref, true, onClose);
  return (
    <div ref={ref} className="mt-3 mb-2 pl-8">
      <p className="rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink/90">{text}</p>
    </div>
  );
}

/** One group (Today, Up next, Later, Done). Drop an action on it to move it there. */
function Lane({ id, title, empty, children }: { id?: Lane; title: string; empty: string | null; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: id ?? `fixed-${title}`, disabled: !id });
  return (
    <section ref={setNodeRef} aria-label={title} className={`-mx-2 rounded-2xl px-2 transition-colors ${isOver ? "bg-surface" : ""}`}>
      <h2 className="section-title">{title.toLowerCase()}</h2>
      <ul className="mt-1">{children}</ul>
      {empty && <p className="py-2 text-sm text-muted">{empty}</p>}
    </section>
  );
}

/** An action you can pick up by the dots on its left and drop in another group. */
function Row({ id, open, children }: { id: string; open: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id });
  return (
    <li ref={setNodeRef} id={`action-${id}`} className={`group relative border-b border-line ${open ? "py-3" : "py-1.5"} ${isDragging ? "opacity-30" : ""}`}>
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        type="button"
        aria-label="Drag to move"
        className="absolute top-2 -left-5 hidden h-5 w-4 cursor-grab touch-none place-items-center text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 sm:grid"
      >
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
          {[2, 6, 10].map((y) => [2, 6].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1" fill="currentColor" />))}
        </svg>
      </button>
      {/* On a phone there's no handle: press and hold the row, then drag. */}
      <div onTouchStart={listeners?.onTouchStart as React.TouchEventHandler | undefined}>{children}</div>
    </li>
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
    <LineEdit
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={onFocus}
      onBlur={() => {
        if (!value.trim()) return setValue(task.title);
        if (value !== task.title) onRename(value.trim());
      }}
      aria-label="Action"
      className={`w-full bg-transparent focus:outline-none ${done ? "text-muted line-through decoration-line" : ""}`}
    />
  );
}
