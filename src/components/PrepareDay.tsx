"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "./Mark";

/** Shown the first time you open the app each day while the partner prepares it. */
export function PrepareDay({ auto = true }: { auto?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">(auto ? "working" : "idle");

  async function run(force = false) {
    setState("working");
    // Another tab may be preparing the same day; wait for it rather than starting twice.
    for (let attempt = 0; attempt < 20; attempt++) {
      const res = await fetch("/api/day", { method: "POST", body: JSON.stringify({ force: force && attempt === 0 }) });
      if (!res.ok) return setState("error");
      const { ready } = await res.json();
      if (ready) {
        if (!auto) setState("idle");
        return router.refresh();
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    setState("error");
  }

  useEffect(() => {
    if (auto) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!auto) {
    // A small ↻ beside the date: a fresh affirmation, focus line, reading and question.
    const label = state === "working" ? "Preparing a fresh take…" : state === "error" ? "Couldn't prepare today. Try again" : "Prepare today again";
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={state === "working"}
        onClick={() => run(true)}
        className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full align-middle text-muted hover:bg-surface hover:text-ink disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={state === "working" ? "animate-spin" : ""} aria-hidden="true">
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <path d="M13.5 2.5v3h-3" />
        </svg>
        {state === "error" && <span className="sr-only">{label}</span>}
      </button>
    );
  }

  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
      <Mark size={40} className={`text-ink ${state === "working" ? "breathe" : ""}`} />
      <p className="mt-4 font-serif text-xl">{state === "error" ? "Today didn't come together." : "Preparing your day…"}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        {state === "error" ? "Check your connection, then try again." : "Reading your visions, recent work and journal."}
      </p>
      {state === "error" && (
        <button className="btn mt-4" onClick={() => run()}>Try again</button>
      )}
    </div>
  );
}
