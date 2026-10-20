"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPractice, renamePracticeTo, removePractice, reorderPractices, linkPractice, logPractice } from "@/app/actions";
import { RemoveX } from "./RemoveX";

export type Practice = { id: string; name: string; sort: number };
type Project = { id: string; title: string };

const pill = (on: boolean) => `rounded-full border px-2.5 py-1 text-xs ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`;

function lastLabel(day: string | undefined, today: string) {
  if (!day) return "not yet";
  if (day === today) return "today";
  const diff = Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(day + "T12:00:00Z")) / 86400_000);
  if (diff === 1) return "yesterday";
  const d = new Date(day + "T12:00:00Z");
  return diff < 7 ? d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Your practices: what you make and offer. Tap one to link the projects it feeds; tick it when you practice. */
export function PracticeList({
  practices: initial,
  projects,
  links,
  sessions,
  today,
  weekStart,
}: {
  practices: Practice[];
  projects: Project[];
  links: { practice_id: string; project_id: string }[];
  sessions: { practice_id: string; day: string }[];
  today: string;
  weekStart: string;
}) {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("");
  const [, start] = useTransition();
  useEffect(() => {
    setItems(initial);
  }, [initial]);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(items, items.findIndex((p) => p.id === e.active.id), items.findIndex((p) => p.id === e.over!.id));
    setItems(next);
    start(() => reorderPractices(next.map((p) => p.id)));
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          start(() => createPractice(n));
        }}
        className="flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a practice" aria-label="Add a practice" className="field min-w-0 flex-1" />
        <button className="btn" disabled={!name.trim()}>Add</button>
      </form>

      {items.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-line">
              {items.map((p) => (
                <Row
                  key={p.id}
                  p={p}
                  projects={projects}
                  linked={links.filter((l) => l.practice_id === p.id).map((l) => l.project_id)}
                  days={sessions.filter((s) => s.practice_id === p.id).map((s) => s.day)}
                  today={today}
                  weekStart={weekStart}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-muted">Add what you make and offer: DJing, pottery, cooking, baking, fermenting.</p>
      )}
    </div>
  );
}

function Row({ p, projects, linked, days, today, weekStart }: { p: Practice; projects: Project[]; linked: string[]; days: string[]; today: string; weekStart: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const [name, setName] = useState(p.name);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useOptimistic(days.includes(today));
  const [links, setLinks] = useOptimistic(linked);
  const [, start] = useTransition();

  const thisWeek = days.filter((d) => d >= weekStart).length + (done && !days.includes(today) ? 1 : 0) - (!done && days.includes(today) ? 1 : 0);
  const last = done ? today : [...days].filter((d) => d !== today).sort().pop();
  const feeds = projects.filter((x) => links.includes(x.id)).map((x) => x.title);

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group relative bg-bg py-3 ${isDragging ? "z-10 opacity-80" : ""}`}>
      <div className="flex items-center gap-3">
        <button ref={setActivatorNodeRef} {...listeners} {...attributes} aria-label={`Drag to reorder ${p.name}`} className="-ml-1 cursor-grab touch-none p-1 text-muted hover:text-ink active:cursor-grabbing">
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
            {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />))}
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              if (!name.trim()) return setName(p.name);
              if (name !== p.name) start(() => renamePracticeTo(p.id, name));
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Practice"
            className="w-full bg-transparent font-serif text-lg focus:outline-none"
          />
          <button type="button" onClick={() => setOpen((o) => !o)} className="block text-left text-xs text-muted hover:text-ink">
            {thisWeek}× this week · last {lastLabel(last, today)}
            {feeds.length ? ` · feeds ${feeds.join(", ")}` : ""}
          </button>
        </div>
        <button
          type="button"
          aria-pressed={done}
          onClick={() =>
            start(async () => {
              setDone(!done);
              await logPractice(p.id, today, !done);
            })
          }
          className={pill(done)}
        >
          {done ? "Practiced today" : "Practiced today?"}
        </button>
        <RemoveX label={`Remove ${p.name}`} confirm={`Remove "${p.name}"?`} action={() => removePractice(p.id)} className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" />
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-7">
          <span className="mr-1 text-xs text-muted">Feeds</span>
          {projects.length ? (
            projects.map((x) => {
              const on = links.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    start(async () => {
                      setLinks(on ? links.filter((l) => l !== x.id) : [...links, x.id]);
                      await linkPractice(p.id, x.id, !on);
                    })
                  }
                  className={pill(on)}
                >
                  {x.title}
                </button>
              );
            })
          ) : (
            <span className="text-xs text-muted">no projects yet</span>
          )}
          <button type="button" onClick={() => setOpen(false)} className="ml-1 text-xs text-muted hover:text-ink">Done</button>
        </div>
      )}
    </li>
  );
}

/** On Today: tap what you practiced. */
export function PracticeToday({ practices, practiced, today }: { practices: Practice[]; practiced: string[]; today: string }) {
  const [done, setDone] = useOptimistic(new Set(practiced), (s: Set<string>, { id, on }: { id: string; on: boolean }) => {
    const n = new Set(s);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });
  const [, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {practices.map((p) => {
        const on = done.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              start(async () => {
                setDone({ id: p.id, on: !on });
                await logPractice(p.id, today, !on);
              })
            }
            className={`rounded-full border px-3 py-1 text-sm ${on ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
          >
            {p.name}
          </button>
        );
      })}
    </div>
  );
}
