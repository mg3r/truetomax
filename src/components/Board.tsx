"use client";

import { useEffect, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { moveTask, deleteTask, type Lane } from "@/app/actions";
import { RemoveX } from "./RemoveX";

export type BoardTask = { id: string; title: string; status: string; day: string | null; source: string; reason: string | null; routine_id?: string | null };

export const LANES: { id: Lane; title: string; hint: string; empty: string }[] = [
  { id: "later", title: "Later", hint: "Not scheduled", empty: "Ideas and someday tasks wait here." },
  { id: "next", title: "Up next", hint: "Your partner offers these", empty: "Drag something here to line it up." },
  { id: "today", title: "Today", hint: "Shows on Today", empty: "Nothing for this project today." },
  { id: "done", title: "Done", hint: "Last two weeks", empty: "Finished work lands here." },
];

export function laneOf(t: BoardTask, today: string): Lane {
  if (t.status === "done") return "done";
  if (!t.day) return "later";
  return t.day <= today ? "today" : "next";
}

function shortDate(day: string) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function Board({ tasks: initial, today }: { tasks: BoardTask[]; today: string }) {
  const [tasks, setTasks] = useState(initial);
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    setTasks(initial);
  }, [initial]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On phones, press and hold to drag, so swiping across lanes still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  function move(id: string, lane: Lane) {
    // Move it on screen right away; the server catches up.
    setTasks((ts) =>
      ts.map((t) =>
        t.id !== id
          ? t
          : lane === "done"
            ? { ...t, status: "done" }
            : { ...t, status: "todo", day: lane === "later" ? null : lane === "today" ? today : "9999-12-31" }
      )
    );
    start(() => moveTask(id, lane));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const lane = e.over?.id as Lane | undefined;
    const task = tasks.find((t) => t.id === e.active.id);
    if (lane && task && laneOf(task, today) !== lane) move(task.id, lane);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(tasks.find((t) => t.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      {/* Phone: swipe across the four lanes. Desktop: all four side by side. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
        {LANES.map((lane) => (
          <Column
            key={lane.id}
            lane={lane}
            today={today}
            tasks={tasks.filter((t) => laneOf(t, today) === lane.id)}
            onMove={move}
            onDelete={(id) => {
              setTasks((ts) => ts.filter((t) => t.id !== id));
              start(() => deleteTask(id));
            }}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && <div className="pebble rotate-2 border border-ink bg-surface px-3 py-2.5 text-[0.95rem] shadow-[0_16px_40px_-16px_rgb(0_0_0/0.45)]">{dragging.title}</div>}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  lane,
  today,
  tasks,
  onMove,
  onDelete,
}: {
  lane: (typeof LANES)[number];
  today: string;
  tasks: BoardTask[];
  onMove: (id: string, lane: Lane) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });
  const sorted = [...tasks].sort((a, b) => (a.day ?? "").localeCompare(b.day ?? ""));

  return (
    <section
      ref={setNodeRef}
      aria-label={lane.title}
      className={`pebble-alt flex w-[78vw] max-w-[19rem] shrink-0 snap-start flex-col p-3 transition-colors sm:w-auto sm:max-w-none ${
        isOver ? "bg-faint ring-1 ring-ink" : "bg-surface"
      }`}
    >
      <header className="flex items-baseline justify-between px-1">
        <h3 className="font-medium">{lane.title}</h3>
        <span className="text-xs text-muted tabular-nums">{tasks.length}</span>
      </header>
      <p className="px-1 text-xs text-muted">{lane.hint}</p>

      <ul className="mt-3 flex min-h-16 flex-col gap-2">
        {sorted.map((t) => (
          <Card key={t.id} task={t} lane={lane.id} today={today} onMove={onMove} onDelete={onDelete} />
        ))}
        {!tasks.length && <li className="px-1 py-3 text-sm text-muted">{lane.empty}</li>}
      </ul>

    </section>
  );
}

function Card({ task, lane, today, onMove, onDelete }: { task: BoardTask; lane: Lane; today: string; onMove: (id: string, lane: Lane) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const [open, setOpen] = useState(false);
  const meta = [
    lane === "next" && task.day && task.day !== "9999-12-31" ? shortDate(task.day) : null,
    lane === "today" && task.day && task.day < today ? "carried over" : null,
    task.source === "rhythm" ? "weekly rhythm" : task.source === "partner" ? "from your partner" : null,
  ].filter(Boolean);

  return (
    <li ref={setNodeRef} className={isDragging ? "opacity-30" : ""}>
      <div className="pebble relative border border-line bg-bg">
        <RemoveX label={`Delete ${task.title}`} action={() => onDelete(task.id)} className="absolute top-1 right-1 !h-6 !w-6" />
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`${task.title}. Drag to move, or press to see options.`}
          onClick={() => setOpen((o) => !o)}
          className="w-full cursor-grab touch-manipulation py-2.5 pr-8 pl-3 text-left active:cursor-grabbing"
        >
          <span className={`block text-[0.95rem] leading-snug ${lane === "done" ? "text-muted line-through decoration-line" : ""}`}>{task.title}</span>
          {meta.length > 0 && <span className="mt-1 block text-xs text-muted">{meta.join(", ")}</span>}
        </button>
        {open && (
          <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2.5">
            {LANES.filter((l) => l.id !== lane).map((l) => (
              <button key={l.id} type="button" className="btn-quiet !px-2.5 !py-1 text-xs" onClick={() => onMove(task.id, l.id)}>
                {l.id === "done" ? "Mark done" : `Move to ${l.title}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
