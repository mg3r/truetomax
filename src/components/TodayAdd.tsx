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

const pill = (on: boolean) => `rounded-full border px-2.5 py-1 ${on ? "border-ink bg-ink text-bg" : "border-transparent text-muted hover:text-ink"}`;

/** Add a task for today: just type it. When and which project are there if you want them, set to Anytime and none. */
export function TodayAdd({ day, projects }: { day: string; projects: { id: string; title: string }[] }) {
  const [title, setTitle] = useState("");
  const [part, setPart] = useState("");
  const [time, setTime] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = title.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const input = { title, repeat: false, weekdays: [], date: day, part_of_day: part || null, at_time: time || null, project_id: project };
        start(async () => {
          await addToSchedule(input);
          setTitle("");
          setPart("");
          setTime("");
          setProject(null);
        });
      }}
      className="mt-3"
    >
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for today" aria-label="Add a task for today" className="field min-w-0 flex-1" />
        <button className="btn" disabled={pending || !open}>Add</button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
          {PARTS.map((p) => (
            <button key={p.label} type="button" aria-pressed={part === p.value && !time} onClick={() => { setPart(p.value); setTime(""); }} className={pill(part === p.value && !time)}>
              {p.label}
            </button>
          ))}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Exact time (optional)" className={`rounded-full border bg-transparent px-2.5 py-0.5 ${time ? "border-ink text-ink" : "border-line text-muted"}`} />
        </div>
      )}
      {open && (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="Project (optional)">
          <button type="button" aria-pressed={project === null} onClick={() => setProject(null)} className={pill(project === null)}>
            No project
          </button>
          {projects.map((p) => (
            <button key={p.id} type="button" aria-pressed={project === p.id} onClick={() => setProject(p.id)} className={pill(project === p.id)}>
              {p.title}
            </button>
          ))}
          {!projects.length && (
            <Link href="/projects" className="px-2.5 py-1 text-muted underline decoration-line underline-offset-4 hover:text-ink">
              Start a project
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
