"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addRoutine, updateRoutine, deleteRoutine, checkRoutine, reorderRoutines } from "@/app/actions";
import { RemoveX } from "./RemoveX";
import { CADENCES, DAY_LETTERS, timesOf, isPinned, type Routine } from "@/lib/routine";

// Monday first, like the Schedule.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`btn-quiet ${on ? "!border-ink !bg-ink !text-bg" : ""}`}
    >
      {children}
    </button>
  );
}

function Check({ done, title, onClick }: { done: boolean; title: string; onClick: () => void }) {
  return (
    <button
      aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
      onClick={onClick}
      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-check border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
    >
      {done && (
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** How many times a week: − 2× +. */
function Times({ value, onChange, small = false }: { value: number; onChange: (n: number) => void; small?: boolean }) {
  const btn = small ? "h-5 w-5" : "h-8 w-8";
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Times a week">
      <button type="button" aria-label="Fewer" disabled={value <= 1} onClick={() => onChange(value - 1)} className={`${btn} grid place-items-center rounded-full border border-line text-muted hover:text-ink disabled:opacity-30`}>−</button>
      <span className="min-w-[1.75rem] text-center tabular-nums">{value}×</span>
      <button type="button" aria-label="More" disabled={value >= 7} onClick={() => onChange(value + 1)} className={`${btn} grid place-items-center rounded-full border border-line text-muted hover:text-ink disabled:opacity-30`}>+</button>
    </span>
  );
}

/** Today's routine: tick things off as you go. Nightly sits last, for the evening. */
export function RoutineToday({ items, checked, day, times = {}, weekDone = {} }: { items: Routine[]; checked: string[]; day: string; times?: Record<string, string>; weekDone?: Record<string, number> }) {
  const [done, setDone] = useOptimistic(new Set(checked), (s: Set<string>, { id, on }: { id: string; on: boolean }) => {
    const n = new Set(s);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });
  const [, start] = useTransition();
  const toggle = (id: string) => {
    const on = !done.has(id);
    start(async () => {
      setDone({ id, on });
      await checkRoutine(id, day, on);
    });
  };

  const groups = [
    { label: "today", list: items.filter((r) => r.cadence === "daily") },
    { label: "tonight", list: items.filter((r) => r.cadence === "nightly") },
    { label: "weekly", list: items.filter((r) => r.cadence === "weekly") },
  ].filter((g) => g.list.length);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          {groups.length > 1 && <p className="text-xs text-muted">{g.label}</p>}
          <ul className="mt-1 divide-y divide-line">
            {g.list.map((r) => {
              const on = done.has(r.id);
              return (
                <li key={r.id} className="flex items-start gap-3 py-2.5">
                  <Check done={on} title={r.title} onClick={() => toggle(r.id)} />
                  <span className={`min-w-0 flex-1 ${on ? "text-muted line-through decoration-line" : ""}`}>{r.title}</span>
                  {r.id in times && <span className="shrink-0 text-xs text-muted tabular-nums">{times[r.id] || "calendar"}</span>}
                  {r.cadence === "weekly" && !isPinned(r) && (
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {(weekDone[r.id] ?? 0) + (on ? 1 : 0)} of {timesOf(r)} this week
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The routine itself: add at the top, edit in place, and see the last week at a glance. */
export function RoutineEditor({ items: initial, checks, week }: { items: Routine[]; checks: { routine_id: string; day: string }[]; week: string[] }) {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    setItems(initial);
  }, [initial]);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 4 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((r) => r.id === e.active.id);
    const to = items.findIndex((r) => r.id === e.over!.id);
    if (items[from]?.cadence !== items[to]?.cadence) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    start(() => reorderRoutines(next.map((r) => r.id)));
  };
  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<Routine["cadence"]>("daily");
  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState(1);
  const [pending, start] = useTransition();
  const doneOn = new Set(checks.map((c) => `${c.routine_id}:${c.day}`));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    start(async () => {
      await addRoutine(t, cadence, days, times);
      setTitle("");
      setDays([]);
    });
  };

  return (
    <div className="space-y-12">
      <form onSubmit={add} className="pebble bg-surface p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to your routine" aria-label="Add to your routine" className="field" />
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="How often">
          {CADENCES.map((c) => (
            <Chip key={c.value} on={cadence === c.value} onClick={() => setCadence(c.value)}>
              {c.label}
            </Chip>
          ))}
        </div>
        {cadence === "weekly" && (
          <div className="mt-3 flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="How many times, and which days">
            {!days.length && (
              <span className="mr-1">
                <Times value={times} onChange={setTimes} />
              </span>
            )}
            {!days.length && <span aria-hidden="true" className="mx-1 h-4 border-l border-line" />}
            {[{ d: -1, label: "Any day" }, ...WEEK.map((d) => ({ d, label: DAY_LETTERS[d] }))].map(({ d, label }) => {
              const on = d === -1 ? !days.length : days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => (d === -1 ? setDays([]) : setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d])))}
                  className={`rounded-full border px-2.5 py-1 ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <button className="btn mt-4" disabled={pending || !title.trim()}>
          Add
        </button>
      </form>

      {CADENCES.map((c) => {
        const list = items.filter((r) => r.cadence === c.value);
        if (!list.length) return null;
        return (
          <section key={c.value} aria-label={c.label}>
            <h2 className="font-serif text-xl">{c.label}</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={list.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <ul className="mt-2 divide-y divide-line">
                  {list.map((r) => (
                    <RoutineRow key={r.id} r={r} week={week} doneOn={doneOn} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}

      {!items.length && <p className="text-muted">Nothing here yet. Start with the one thing you want to do every day.</p>}
    </div>
  );
}

function RoutineRow({ r, week, doneOn }: { r: Routine; week: string[]; doneOn: Set<string> }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const [title, setTitle] = useState(r.title);
  const [, start] = useTransition();
  const toggleDay = (d: number) => {
    const next = r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d];
    start(() => updateRoutine(r.id, { weekdays: next, ...(next.length ? { times_per_week: next.length } : {}) }));
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative bg-bg py-3 ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <div className="flex items-center gap-3">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Drag to reorder ${r.title}`}
          className="-ml-1 cursor-grab touch-none p-1 text-muted hover:text-ink active:cursor-grabbing"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
            {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />))}
          </svg>
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== r.title && start(() => updateRoutine(r.id, { title }))}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="What"
          className="min-w-0 flex-1 bg-transparent focus:outline-none"
        />
        {/* The last seven days: filled where you did it. */}
        <span className="flex shrink-0 gap-1" aria-label={`Done ${week.filter((d) => doneOn.has(`${r.id}:${d}`)).length} of the last 7 days`}>
          {week.map((d) => (
            <span key={d} aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${doneOn.has(`${r.id}:${d}`) ? "bg-ink" : "bg-line"}`} />
          ))}
        </span>
        <RemoveX label={`Remove ${r.title}`} confirm={`Remove "${r.title}" from your routine?`} action={() => deleteRoutine(r.id)} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-7 text-xs">
        {CADENCES.map((c) => (
          <button
            key={c.value}
            onClick={() =>
              c.value !== r.cadence && start(() => updateRoutine(r.id, { cadence: c.value, ...(c.value === "weekly" ? { weekdays: [], times_per_week: 1 } : {}) }))
            }
            className={`rounded-full px-1.5 py-0.5 ${c.value === r.cadence ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
          >
            {c.label.toLowerCase()}
          </button>
        ))}
        {r.cadence === "weekly" && !isPinned(r) && (
          <span className="ml-1">
            <Times small value={timesOf(r)} onChange={(n) => start(() => updateRoutine(r.id, { times_per_week: n }))} />
          </span>
        )}
        {r.cadence === "weekly" && (
          <>
            <span aria-hidden="true" className="mx-1 h-3 self-center border-l border-line" />
            <button
              aria-pressed={!isPinned(r)}
              onClick={() => isPinned(r) && start(() => updateRoutine(r.id, { weekdays: [], times_per_week: timesOf(r) }))}
              className={`rounded-full px-1.5 py-0.5 ${!isPinned(r) ? "border border-ink text-ink" : "border border-transparent text-muted hover:text-ink"}`}
            >
              any day
            </button>
            {WEEK.map((d) => (
              <button
                key={d}
                aria-pressed={r.weekdays.includes(d)}
                onClick={() => toggleDay(d)}
                className={`rounded-full px-1.5 py-0.5 ${r.weekdays.includes(d) ? "border border-ink text-ink" : "border border-transparent text-muted hover:text-ink"}`}
              >
                {DAY_LETTERS[d]}
              </button>
            ))}
          </>
        )}
      </div>
    </li>
  );
}
