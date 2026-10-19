"use client";

import { useState, useTransition } from "react";
import { saveJournal } from "@/app/actions";

export function JournalForm({
  id,
  prompt,
  day,
  initial = "",
  placeholder = "Write freely. Answer the question, or anything else that's here today.",
}: {
  id?: string;
  prompt?: string | null;
  day?: string;
  initial?: string;
  placeholder?: string;
}) {
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = body.trim() !== saved.trim();

  return (
    <form
      action={(fd) =>
        start(async () => {
          await saveJournal(fd);
          setSaved(body);
          if (!id) {
            setBody("");
            setSaved("");
          }
        })
      }
    >
      {id && <input type="hidden" name="id" value={id} />}
      {prompt && <input type="hidden" name="prompt" value={prompt} />}
      {day && <input type="hidden" name="day" value={day} />}
      <textarea
        name="body"
        rows={7}
        className="field"
        placeholder={placeholder}
        aria-label="Journal entry"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted">{pending ? "Saving…" : !dirty && saved ? "Saved" : ""}</span>
        <button className="btn" disabled={pending || !dirty || !body.trim()}>
          {id ? "Save changes" : "Save entry"}
        </button>
      </div>
    </form>
  );
}
