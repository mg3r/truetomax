"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { updateProject, deleteProject, acceptProject } from "@/app/actions";
import { RemoveX } from "./RemoveX";

export type BoardProject = { id: string; title: string; status: string; next: string | null; open: number };

const COLUMNS = [
  { id: "review", title: "In review", empty: "Projects you're still deciding on." },
  { id: "active", title: "In progress", empty: "Drag a project here to start it." },
  { id: "paused", title: "Backlog", empty: "Not now, maybe later." },
  { id: "done", title: "Done", empty: "Finished projects." },
] as const;

const columnOf = (status: string) => (status === "eliminated" ? "done" : status);

/** Your projects as a board: drag a card to change its status, tap it to open. */
export function ProjectBoard({ projects: initial }: { projects: BoardProject[] }) {
  const [projects, setProjects] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    setProjects(initial);
  }, [initial]);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  function move(id: string, status: string) {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
    start(() => updateProject(id, { status }));
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const to = e.over?.id as string | undefined;
    const p = projects.find((x) => x.id === e.active.id);
    if (to && p && columnOf(p.status) !== to) move(p.id, to);
  }

  const active = projects.find((p) => p.id === dragging);

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragging(e.active.id as string)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((c) => (
          <Column key={c.id} id={c.id} title={c.title} empty={c.empty} count={projects.filter((p) => columnOf(p.status) === c.id).length}>
            {projects
              .filter((p) => columnOf(p.status) === c.id)
              .map((p) => (
                <Card
                  key={p.id}
                  p={p}
                  onAccept={() => {
                    setProjects((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: "active" } : x)));
                    start(() => acceptProject(p.id));
                  }}
                  onDelete={() => {
                    setProjects((ps) => ps.filter((x) => x.id !== p.id));
                    return deleteProject(p.id, false);
                  }}
                />
              ))}
          </Column>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <CardBody p={active} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, title, empty, count, children }: { id: string; title: string; empty: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={title} className={`pebble min-h-32 bg-surface p-3 transition-shadow ${isOver ? "shadow-[0_0_0_1px_var(--ink)]" : ""}`}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="text-xs text-muted tabular-nums">{count}</span>
      </div>
      <ul className="mt-3 space-y-2">{children}</ul>
      {!count && <p className="px-1 pt-1 text-xs text-muted">{empty}</p>}
    </section>
  );
}

function Card({ p, onAccept, onDelete }: { p: BoardProject; onAccept: () => void; onDelete: () => Promise<void> }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id });
  return (
    <li ref={setNodeRef} {...listeners} {...attributes} className={`touch-manipulation ${isDragging ? "opacity-30" : ""}`}>
      <CardBody p={p} onAccept={onAccept} onDelete={onDelete} />
    </li>
  );
}

function CardBody({ p, lifted = false, onAccept, onDelete }: { p: BoardProject; lifted?: boolean; onAccept?: () => void; onDelete?: () => Promise<void> }) {
  const status = columnOf(p.status);
  return (
    <div className={`relative rounded-2xl border border-line bg-bg p-3 ${lifted ? "shadow-lg" : ""}`}>
      {onDelete && <RemoveX label={`Delete ${p.title}`} confirm={`Delete "${p.title}" and its actions?`} action={onDelete} className="absolute top-1.5 right-1.5 !h-6 !w-6" />}
      <Link href={`/projects/${p.id}`} className="block pr-6 font-serif text-[1.05rem] leading-snug hover:underline hover:decoration-line hover:underline-offset-4">
        {p.title}
      </Link>
      {status === "active" && (
        <p className="mt-1.5 text-xs text-muted">
          {p.next ? <>Next: <span className="text-ink">{p.next}</span></> : "No next step yet"}
        </p>
      )}
      {status === "review" && onAccept && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onAccept}
          className="mt-2 rounded-full border border-ink px-3 py-1 text-xs text-ink hover:bg-ink hover:text-bg"
        >
          Accept
        </button>
      )}
    </div>
  );
}
