"use client";

import { useState } from "react";
import { saveProject } from "@/app/actions";

/** "Start a project": just the name until you tap it, then a line for what it's for. */
export function NewProject() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <form
      action={saveProject}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node) && !title.trim()) setOpen(false);
      }}
      className="pebble bg-surface p-5"
    >
      <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setOpen(true)} placeholder="Start a project" aria-label="Project name" className="field" />
      {open && (
        <div className="mt-3 space-y-3">
          <textarea name="description" rows={2} placeholder="What it is and what it's for (optional)" aria-label="Description" className="field" />
          <button className="btn" disabled={!title.trim()}>Start it</button>
        </div>
      )}
    </form>
  );
}
