"use client";

import { useTransition, useRef, useState } from "react";
import { namesOf, projectsOf, practicesOf } from "@/lib/links";
import { setTaskStatus, deleteTask, addTask } from "@/app/actions";
import { Select } from "./Select";
import { RemoveX } from "./RemoveX";
import { ActionEditor, type EditableAction } from "./ActionEditor";

export type Task = {
  id: string;
  title: string;
  status: string;
  source: string;
  reason: string | null;
  day: string | null;
  at_time?: string | null;
  part_of_day?: string | null;
  project?: string | null;
  practice?: string | null;
};

export function clock(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** A calendar event in the day's list: same rhythm as a task row, but nothing to check off. */
export function EventRow({ time, title, calendar, location, link }: { time: string; title: string; calendar: string; location?: string; link?: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="w-16 shrink-0 pt-0.5 text-sm text-muted tabular-nums">{time}</span>
      <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
      <div className="min-w-0 flex-1">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">{title}</a>
        ) : (
          <p>{title}</p>
        )}
        <p className="text-xs text-muted">{[calendar, location].filter(Boolean).join(", ")}</p>
      </div>
    </li>
  );
}

export function TaskRow({ task, today, showProject = true, aside, showTime = false }: { task: Task; today?: string; showProject?: boolean; aside?: React.ReactNode; showTime?: boolean }) {
  const [pending, start] = useTransition();
  const done = task.status === "done";
  const carried = today && task.day && task.day < today && !done;

  return (
    <li className={`group flex items-start gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      {showTime && <span className="w-16 shrink-0 pt-0.5 text-sm text-muted tabular-nums">{task.at_time ? clock(task.at_time) : ""}</span>}
      <button
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        onClick={() => start(() => setTaskStatus(task.id, done ? "todo" : "done"))}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center ring-check border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={done ? "text-muted line-through decoration-line" : ""}>{task.title}</p>
        <p className="text-xs text-muted">
          {[!task.at_time && task.part_of_day, showProject && task.project, task.practice, task.source === "rhythm" && "your schedule", carried && "carried over"].filter(Boolean).join(", ")}
        </p>
      </div>
      {aside && <div className="shrink-0 self-center">{aside}</div>}
      {!done && (
        <button className="self-center text-xs text-muted hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" onClick={() => start(() => setTaskStatus(task.id, "skipped"))}>
          Skip
        </button>
      )}
      <RemoveX label={`Delete ${task.title}`} action={() => deleteTask(task.id)} className="-my-1 self-center" />
    </li>
  );
}

export function SuggestionRow({
  task,
  today = "",
  projects = [],
  practices = [],
}: {
  task: Task & { project_id?: string | null; routine_id?: string | null; project_ids?: string[] | null; routine_ids?: string[] | null };
  today?: string;
  projects?: { id: string; title: string }[];
  practices?: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<EditableAction>({ id: task.id, day: task.day, status: task.status, part_of_day: task.part_of_day ?? null, at_time: task.at_time ?? null, project_id: task.project_id ?? null, routine_id: task.routine_id ?? null, project_ids: task.project_ids ?? null, routine_ids: task.routine_ids ?? null });
  const project = projects.length ? namesOf(projectsOf(a), new Map(projects.map((p) => [p.id, p.title]))) : task.project;
  const practice = practices.length ? namesOf(practicesOf(a), new Map(practices.map((p) => [p.id, p.name]))) : task.practice;
  const when = a.at_time ? clock(a.at_time) : a.part_of_day;
  return (
    <li className={`py-3 ${pending ? "opacity-50" : ""}`}>
      {(project || practice || when) && <p className="text-xs text-muted">{[project && `From ${project}`, practice, when].filter(Boolean).join(" · ")}</p>}
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left font-medium hover:underline hover:decoration-line hover:underline-offset-4">
        {task.title}
      </button>
      {task.reason && <p className="mt-0.5 text-sm text-muted">{task.reason}</p>}
      {open && (
        <ActionEditor action={a} today={today} projects={projects} practices={practices} showWhere={false} onChange={(patch) => setA((x) => ({ ...x, ...patch }))} onClose={() => setOpen(false)} />
      )}
      <div className="mt-2 flex gap-2">
        <button className="btn-quiet !border-ink !text-ink" onClick={() => start(() => setTaskStatus(task.id, "todo"))}>
          Add to today
        </button>
        <button className="btn-quiet" onClick={() => start(() => setTaskStatus(task.id, "skipped"))}>
          Not today
        </button>
      </div>
    </li>
  );
}

export function AddTask({
  projects,
  day,
  projectId,
  placeholder = "Add a task for today",
  allowBacklog = false,
}: {
  projects?: { id: string; title: string }[];
  day?: string;
  projectId?: string;
  placeholder?: string;
  allowBacklog?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await addTask(fd);
        ref.current?.reset();
      }}
      className="mt-2 flex flex-wrap gap-2"
    >
      {day && <input type="hidden" name="day" value={day} />}
      {projectId && <input type="hidden" name="project_id" value={projectId} />}
      <input name="title" required placeholder={placeholder} aria-label={placeholder} className="field min-w-0 flex-1" />
      {projects && !projectId && (
        <Select name="project_id" label="Project" className="w-44" options={[{ value: "", label: "No project" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />
      )}
      {allowBacklog && (
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" name="backlog" /> Later
        </label>
      )}
      <button className="btn">Add</button>
    </form>
  );
}
