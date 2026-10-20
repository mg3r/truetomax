"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { addRoutine, updateRoutine, deleteRoutine, checkRoutine, reorderRoutines, setRoutineKind, linkRoutineProject } from "@/app/actions";
import { RemoveX } from "./RemoveX";
import { LineEdit } from "./LineEdit";
import { CADENCES, DAY_LETTERS, timesOf, isPinned, isPractice, type Routine } from "@/lib/routine";

type Project = { id: string; title: string };
type Link = { routine_id: string; project_id: string };
const KINDS = [
  { value: "ritual", label: "Ritual" },
  { value: "practice", label: "Practice" },
] as const;

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

type Timed = Routine & { at_time?: string | null; part_of_day?: string | null };
const PART_ORDER: Record<string, number> = { morning: 1, afternoon: 2, evening: 3 };
const clockOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
/** A Rhythm item's time or part of day, if it has one. */
const whenOf = (r: Routine) => {
  const t = r as Timed;
  return t.at_time ? clockOf(t.at_time.slice(0, 5)) : t.part_of_day ?? null;
};
/** Anytime first, then morning, afternoon, evening; by time within each; otherwise your own order. */
const byWhen = (list: Routine[]) =>
  [...list].sort((a, b) => {
    const x = a as Timed;
    const y = b as Timed;
    const px = x.at_time ? PART_ORDER[Number(x.at_time.slice(0, 2)) < 12 ? "morning" : Number(x.at_time.slice(0, 2)) < 17 ? "afternoon" : "evening"] : PART_ORDER[x.part_of_day ?? ""] ?? 0;
    const py = y.at_time ? PART_ORDER[Number(y.at_time.slice(0, 2)) < 12 ? "morning" : Number(y.at_time.slice(0, 2)) < 17 ? "afternoon" : "evening"] : PART_ORDER[y.part_of_day ?? ""] ?? 0;
    return px - py || (x.at_time ?? "").localeCompare(y.at_time ?? "") || a.sort - b.sort;
  });

/** One quiet line describing a Rhythm item: "practice · weekly · 2× · any day · for Dinner series". */
function summaryOf(r: Routine, kinds: boolean, feeds: string[]) {
  const when = whenOf(r);
  return [
    kinds ? (isPractice(r) ? "practice" : "ritual") : null,
    r.cadence,
    r.cadence === "weekly" ? (isPinned(r) ? r.weekdays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_LETTERS[d]).join(", ") : `${timesOf(r)}× · any day`) : null,
    when,
    feeds.length ? `for ${feeds.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
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
    { label: "today", list: byWhen(items.filter((r) => r.cadence === "daily")) },
    { label: "tonight", list: byWhen(items.filter((r) => r.cadence === "nightly")) },
    { label: "weekly", list: byWhen(items.filter((r) => r.cadence === "weekly")) },
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
                  <span className={`min-w-0 flex-1 ${on ? "text-muted line-through decoration-line" : ""}`}>
                    {r.title}
                    <span className="ml-2 text-xs text-muted">{isPractice(r) ? "practice" : "ritual"}</span>
                  </span>
                  {r.id in times ? (
                    <span className="shrink-0 text-xs text-muted tabular-nums">{times[r.id] || "calendar"}</span>
                  ) : (
                    whenOf(r) && <span className="shrink-0 text-xs text-muted tabular-nums">{whenOf(r)}</span>
                  )}
                  {r.cadence === "weekly" && (
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

/** Your rhythm: rituals and practices. Add at the top, edit in place, and see the last week at a glance. */
export function RoutineEditor({
  items: initial,
  checks,
  week,
  projects = [],
  links = null,
}: {
  items: Routine[];
  checks: { routine_id: string; day: string }[];
  week: string[];
  projects?: Project[];
  /** Which projects each practice feeds; null until the Rhythm migration runs. */
  links?: Link[] | null;
}) {
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
  const [kind, setKind] = useState<"ritual" | "practice">("ritual");
  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState(1);
  const [pending, start] = useTransition();
  const doneOn = new Set(checks.map((c) => `${c.routine_id}:${c.day}`));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const t = title;
    start(async () => {
      await addRoutine(t, cadence, days, times, kind);
      setTitle("");
      setDays([]);
    });
  };

  return (
    <div className="space-y-12">
      <form onSubmit={add} className="pebble bg-surface p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to your rhythm" aria-label="Add to your rhythm" className="field" />
        {links !== null && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Ritual or practice">
            {KINDS.map((k) => (
              <Chip key={k.value} on={kind === k.value} onClick={() => setKind(k.value)}>
                {k.label}
              </Chip>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="How often">
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
                    <RoutineRow key={r.id} r={r} week={week} doneOn={doneOn} projects={projects} links={links} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}

      {!items.length && <p className="text-muted">Nothing here yet. Add a ritual that keeps you grounded, or a practice you make and offer.</p>}
    </div>
  );
}

function RoutineRow({ r, week, doneOn, projects, links }: { r: Routine; week: string[]; doneOn: Set<string>; projects: Project[]; links: Link[] | null }) {
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useOptimistic((links ?? []).filter((l) => l.routine_id === r.id).map((l) => l.project_id));
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
        <LineEdit
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => title.trim() && title !== r.title && start(() => updateRoutine(r.id, { title }))}
          aria-label="What"
          className="min-w-0 flex-1 bg-transparent focus:outline-none"
        />
        {/* The last seven days: filled where you did it. */}
        <span className="flex shrink-0 gap-1" aria-label={`Done ${week.filter((d) => doneOn.has(`${r.id}:${d}`)).length} of the last 7 days`}>
          {week.map((d) => (
            <span key={d} aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${doneOn.has(`${r.id}:${d}`) ? "bg-ink" : "bg-line"}`} />
          ))}
        </span>
        <RemoveX label={`Remove ${r.title}`} confirm={`Remove "${r.title}" from your rhythm?`} action={() => deleteRoutine(r.id)} />
      </div>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-0.5 block pl-7 text-left text-xs text-muted hover:text-ink">
          {summaryOf(r, links !== null, projects.filter((p) => feeds.includes(p.id)).map((p) => p.title))}
        </button>
      ) : (
      <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-7 text-xs">
        {links !== null && (
          <>
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => (r.kind ?? "ritual") !== k.value && start(() => setRoutineKind(r.id, k.value))}
                className={`rounded-full px-1.5 py-0.5 ${(r.kind ?? "ritual") === k.value ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
              >
                {k.label.toLowerCase()}
              </button>
            ))}
            <span aria-hidden="true" className="mx-1 h-3 self-center border-l border-line" />
          </>
        )}
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
      )}
      {open && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-7 text-xs">
          {isPractice(r) && links !== null && (
            <>
          <span className="mr-1 text-muted">For</span>
          {projects.length ? (
            projects.map((p) => {
              const on = feeds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    start(async () => {
                      setFeeds(on ? feeds.filter((x) => x !== p.id) : [...feeds, p.id]);
                      await linkRoutineProject(r.id, p.id, !on);
                    })
                  }
                  className={`rounded-full border px-1.5 py-0.5 ${on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  {p.title}
                </button>
              );
            })
          ) : (
            <span className="text-muted">no projects yet</span>
          )}
            </>
          )}
          <button type="button" onClick={() => setOpen(false)} className="ml-auto text-muted hover:text-ink">Done</button>
        </div>
      )}
    </li>
  );
}
