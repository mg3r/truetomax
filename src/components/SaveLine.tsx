"use client";

import { useRef, useState, useTransition } from "react";
import { addHighlight } from "@/app/actions";

/** Save a line from today's page as a passage. Select text on the page first and it's filled in for you. */
export function SaveLine({ book, page }: { book: string; page: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  function openWithSelection() {
    const selected = window.getSelection()?.toString().trim() ?? "";
    setText(selected);
    setSaved(false);
    setOpen(true);
  }

  if (!open) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          // Keep the text selection alive when tapping the button.
          onMouseDown={(e) => e.preventDefault()}
          onClick={openWithSelection}
          className="btn-quiet"
        >
          Save a line
        </button>
        {saved && <span className="text-sm text-muted">Saved to your passages</span>}
      </div>
    );
  }

  return (
    <form
      ref={ref}
      className="mt-3 space-y-2"
      action={(fd) =>
        start(async () => {
          await addHighlight(fd);
          setOpen(false);
          setSaved(true);
        })
      }
    >
      <input type="hidden" name="source" value={book} />
      <input type="hidden" name="location" value={`p. ${page}`} />
      <textarea
        name="text"
        rows={3}
        required
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Select text on the page before tapping Save a line, or type the line here"
        aria-label="Line to save"
        className="field"
      />
      <div className="flex gap-2">
        <button className="btn" disabled={pending || !text.trim()}>{pending ? "Saving…" : "Save passage"}</button>
        <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
