"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { addToSchedule } from "@/app/actions";

const PARTS = [
  { value: "", label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`btn-quiet ${on ? "!border-ink !bg-ink !text-bg" : ""}`}>
      {children}
    </button>
  );
}

/** Add to your week: every week on set days, or just once on a date, optionally as part of a project. */
export function ScheduleAdd({
  week,
  today,
  projects,
  practices = [],
}: {
  week: { date: string; weekday: number; short: string; num: number }[];
  today: string;
  projects: { id: string; title: string }[];
  practices?: { id: string; name: string }[];
}) {
  const todayWd = week.find((d) => d.date === today)?.weekday ?? 1;
  const [title, setTitle] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [days, setDays] = useState<number[]>([todayWd]);
  const [date, setDate] = useState(today);
  const [part, setPart] = useState("");
  const [time, setTime] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [practice, setPractice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const ready = title.trim() && (repeat ? days.length > 0 : !!date);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const input = { title, repeat, weekdays: days, date: repeat ? null : date, part_of_day: part || null, at_time: time || null, project_id: project, practice_id: practice };
        start(async () => {
          await addToSchedule(input);
          setTitle("");
          setTime("");
          setPractice(null);
          setOpen(false);
        });
      }}
      onBlur={(e) => {
        // Leaving an empty form folds it back up.
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !title.trim()) setOpen(false);
      }}
      className="pebble space-y-4 bg-surface p-5"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to your week" aria-label="Add to your week" onFocus={() => setOpen(true)} className="field" />
      {open && (
        <>

      <div className="flex flex-wrap gap-2" role="group" aria-label="How often">
        <Chip on={!repeat} onClick={() => setRepeat(false)}>Just once</Chip>
        <Chip on={repeat} onClick={() => setRepeat(true)}>Every week</Chip>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={repeat ? "Which days" : "Which day"}>
        {week.map((d) =>
          repeat ? (
            <Chip key={d.date} on={days.includes(d.weekday)} onClick={() => setDays((s) => (s.includes(d.weekday) ? s.filter((x) => x !== d.weekday) : [...s, d.weekday]))}>
              {d.short}
            </Chip>
          ) : (
            <Chip key={d.date} on={date === d.date} onClick={() => setDate(d.date)}>
              {d.short}
            </Chip>
          )
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="When in the day">
        {PARTS.map((p) => (
          <Chip key={p.label} on={part === p.value} onClick={() => setPart(p.value)}>
            {p.label}
          </Chip>
        ))}
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Exact time (optional)" className="field ml-1 w-32" />
      </div>

      {practices.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Practice (optional)">
          {practices.map((p) => (
            <Chip
              key={p.id}
              on={practice === p.id}
              onClick={() => {
                const on = practice === p.id;
                setPractice(on ? null : p.id);
                // Picking a practice names the item for you, unless you've typed something.
                if (!on && !title.trim()) setTitle(p.name);
              }}
            >
              {p.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Project (optional)">
        {projects.map((p) => (
          <Chip key={p.id} on={project === p.id} onClick={() => setProject(project === p.id ? null : p.id)}>
            {p.title}
          </Chip>
        ))}
        {!projects.length && (
          <Link href="/projects" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
            Start a project to add actions to it
          </Link>
        )}
      </div>

      <button className="btn" disabled={pending || !ready}>Add</button>
        </>
      )}
    </form>
  );
}
