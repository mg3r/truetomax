"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PickMany } from "./PickMany";
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
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [part, setPart] = useState("");
  const [time, setTime] = useState("");
  const [project, setProject] = useState<string[]>([]);
  const [practice, setPractice] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const ready = title.trim() && !!date;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const input = { title, repeat: false, weekdays: [], date, part_of_day: part || null, at_time: time || null, project_ids: project, practice_ids: practice };
        start(async () => {
          await addToSchedule(input);
          setTitle("");
          setTime("");
          setPractice([]);
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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Which day">
        {week.map((d) => (
          <Chip key={d.date} on={date === d.date} onClick={() => setDate(d.date)}>
            {d.short}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="When in the day">
        {PARTS.map((p) => (
          <Chip key={p.label} on={part === p.value} onClick={() => setPart(p.value)}>
            {p.label}
          </Chip>
        ))}
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Exact time (optional)" className="field ml-1 w-32" />
      </div>

      <PickMany
        label="Practice"
        size="md"
        options={practices}
        value={practice}
        onChange={(next) => {
          setPractice(next);
          // Picking a practice names the item for you, unless you've typed something.
          const name = practices.find((p) => p.id === next[0])?.name;
          if (name && !title.trim()) setTitle(name);
        }}
      />
      {projects.length > 0 ? (
        <PickMany label="Project" size="md" options={projects.map((p) => ({ id: p.id, name: p.title }))} value={project} onChange={setProject} />
      ) : (
        <Link href="/projects" className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
          Start a project to add actions to it
        </Link>
      )}

      <button className="btn" disabled={pending || !ready}>Add</button>
        </>
      )}
    </form>
  );
}
