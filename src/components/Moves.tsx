"use client";

import { useRef, useState, useTransition } from "react";
import { logMove } from "@/app/actions";

const KINDS = [
  { kind: "shared", label: "Shared my work", hint: "What did you share, and where?" },
  { kind: "asked", label: "Asked someone", hint: "Who did you ask, and for what?" },
  { kind: "booked", label: "Got booked", hint: "What's booked?" },
  { kind: "sold", label: "Sold something", hint: "What sold?" },
] as const;

export function MoveLogger() {
  const [kind, setKind] = useState<(typeof KINDS)[number] | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const money = kind?.kind === "booked" || kind?.kind === "sold";

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            aria-pressed={kind?.kind === k.kind}
            onClick={() => setKind(kind?.kind === k.kind ? null : k)}
            className={kind?.kind === k.kind ? "btn" : "btn-quiet"}
          >
            {k.label}
          </button>
        ))}
      </div>
      {kind && (
        <form
          ref={ref}
          action={(fd) =>
            start(async () => {
              await logMove(fd);
              ref.current?.reset();
              setKind(null);
            })
          }
          className="mt-3 flex flex-wrap gap-2"
        >
          <input type="hidden" name="kind" value={kind.kind} />
          <input name="note" autoFocus placeholder={kind.hint} aria-label={kind.hint} className="field min-w-0 flex-1" />
          {money && <input name="amount" type="number" step="any" min="0" placeholder="$" aria-label="Amount in dollars" className="field w-24" />}
          <button className="btn" disabled={pending}>{pending ? "Logging…" : "Log it"}</button>
        </form>
      )}
    </div>
  );
}
