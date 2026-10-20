"use client";

import { useState, useTransition } from "react";
import { updateProject, addGoal, renameGoal, setGoalStatus } from "@/app/actions";
import { Grow } from "./Grow";
import { Select } from "./Select";
import { LineEdit } from "./LineEdit";

// Three states: in progress, in the backlog, or done. (Older "let go" projects count as done.)
const STATUSES = [
  { value: "review", label: "In review" },
  { value: "active", label: "In progress" },
  { value: "paused", label: "Backlog" },
  { value: "done", label: "Done" },
] as const;
const statusOf = (s: string) => (s === "eliminated" ? "done" : s);

/** Project name, description and status, all edited where they sit. */
export function ProjectHeader({ p }: { p: { id: string; title: string; description: string; status: string } }) {
  const [title, setTitle] = useState(p.title);
  const [description, setDescription] = useState(p.description ?? "");
  const [status, setStatus] = useState(p.status);
  const [, start] = useTransition();

  return (
    <div>
      <LineEdit
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() && title !== p.title && start(() => updateProject(p.id, { title }))}
        placeholder="Untitled"
        aria-label="Project name"
        className="w-full bg-transparent font-serif text-3xl leading-tight focus:outline-none"
      />
      {/* Properties, Notion-style: a label on the left, the value on the right. */}
      <dl className="mt-5 grid grid-cols-[6.5rem_1fr] items-start gap-x-3 gap-y-3 text-sm">
        <dt className="pt-1.5 text-muted">Status</dt>
        <dd className="flex flex-wrap items-center gap-2">
        <Select
          key={status}
          name="status"
          label="Status"
          className="w-40"
          defaultValue={statusOf(status)}
          onChange={(v) => {
            setStatus(v);
            start(() => updateProject(p.id, { status: v }));
          }}
          options={STATUSES.map((st) => ({ value: st.value, label: st.label }))}
        />
        </dd>
        <dt className="pt-0.5 text-muted">Description</dt>
        <dd>
          <Grow
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (p.description ?? "") && start(() => updateProject(p.id, { description }))}
            placeholder="What it is and what it's for"
            aria-label="Description"
            className="w-full resize-none overflow-hidden bg-transparent leading-relaxed placeholder:text-muted/70 focus:outline-none"
          />
        </dd>
      </dl>
    </div>
  );
}

type Goal = { id: string; title: string; status: string };

/** Goals: plain text you can edit, and a box to tick when it's true. */
export function GoalList({ projectId, goals }: { projectId: string; goals: Goal[] }) {
  const [draft, setDraft] = useState("");
  const [, start] = useTransition();

  return (
    <div>
      <ul className="divide-y divide-line">
        {goals.map((g) => <GoalItem key={g.id} g={g} />)}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          setDraft("");
          start(() => addGoal(projectId, t));
        }}
        className="flex items-center gap-3 py-2.5"
      >
        <span aria-hidden="true" className="ring-check h-5 w-5 shrink-0 border border-dashed border-line" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a goal"
          aria-label="New goal, then press Enter"
          className="min-w-0 flex-1 bg-transparent placeholder:text-muted focus:outline-none"
        />
      </form>
    </div>
  );
}

function GoalItem({ g }: { g: Goal }) {
  const [title, setTitle] = useState(g.title);
  const [pending, start] = useTransition();
  const done = g.status === "achieved";

  return (
    <li className={`group flex items-center gap-3 py-2.5 ${pending ? "opacity-60" : ""}`}>
      <button
        aria-label={done ? `Mark "${g.title}" not done` : `Mark "${g.title}" done`}
        onClick={() => start(() => setGoalStatus(g.id, done ? "active" : "achieved"))}
        className={`ring-check grid h-5 w-5 shrink-0 place-items-center border ${done ? "border-ink bg-ink text-bg" : "border-muted hover:border-ink"}`}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.5 5 9l5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) return start(() => setGoalStatus(g.id, "dropped")); // clearing a goal removes it
          if (title !== g.title) start(() => renameGoal(g.id, title));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Goal"
        className={`min-w-0 flex-1 bg-transparent focus:outline-none ${done ? "text-muted line-through decoration-line" : ""}`}
      />
    </li>
  );
}
