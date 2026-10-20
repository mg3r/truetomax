"use client";

import { useState, useTransition } from "react";
import { addToSchedule } from "@/app/actions";

const PARTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "", label: "Anytime" },
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
}: {
  week: { date: string; weekday: number; short: string; num: number }[];
  today: string;
  projects: { id: string; title: string }[];
}) {
  const todayWd = week.find((d) => d.date === today)?.weekday ?? 1;
  const [title, setTitle] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [days, setDays] = useState<number[]>([todayWd]);
  const [date, setDate] = useState(today);
  const [part, setPart] = useState("morning");
  const [time, setTime] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ready = title.trim() && (repeat ? days.length > 0 : !!date);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const input = { title, repeat, weekdays: days, date: repeat ? null : date, part_of_day: part || null, at_time: time || null, project_id: project };
        start(async () => {
          await addToSchedule(input);
          setTitle("");
          setTime("");
        });
      }}
      className="pebble space-y-4 bg-surface p-5"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add to your week" aria-label="Add to your week" className="field" />

      <div className="flex flex-wrap gap-2" role="group" aria-label="How often">
        <Chip on={repeat} onClick={() => setRepeat(true)}>Every week</Chip>
        <Chip on={!repeat} onClick={() => setRepeat(false)}>Just once</Chip>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={repeat ? "Which days" : "Which day"}>
        {week.map((d) =>
          repeat ? (
            <Chip key={d.date} on={days.includes(d.weekday)} onClick={() => setDays((s) => (s.includes(d.weekday) ? s.filter((x) => x !== d.weekday) : [...s, d.weekday]))}>
              {d.short}
            </Chip>
          ) : (
            <Chip key={d.date} on={date === d.date} onClick={() => setDate(d.date)}>
              {d.short} {d.num}
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

      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Project (optional)">
          <Chip on={project === null} onClick={() => setProject(null)}>No project</Chip>
          {projects.map((p) => (
            <Chip key={p.id} on={project === p.id} onClick={() => setProject(p.id)}>
              {p.title}
            </Chip>
          ))}
        </div>
      )}

      <button className="btn" disabled={pending || !ready}>Add</button>
    </form>
  );
}
