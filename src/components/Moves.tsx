"use client";

import { useState, useTransition } from "react";
import { addMove, deleteMove } from "@/app/actions";
import { RemoveX } from "./RemoveX";

export type Move = { id: string; kind: string; note: string | null; amount: number | null; day: string; source?: string | null };

const KINDS = [
  { kind: "shared", label: "Shared" },
  { kind: "asked", label: "Asked" },
  { kind: "booked", label: "Booked" },
  { kind: "sold", label: "Sold" },
] as const;

const FROM: Record<string, string> = { action: "from an action", journal: "from your journal", chat: "from a chat", me: "added by you" };

/**
 * This week's moves in one quiet line. They're noticed for you (finished actions, your journal, what you tell
 * your partner, Instagram posts). Tap to see what was counted, remove what isn't right, or add one it missed.
 */
export function MovesLine({ moves }: { moves: Move[] }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [list, setList] = useState(moves);
  const [pending, start] = useTransition();

  const count = (k: string) => list.filter((m) => m.kind === k).length;
  const earned = list.reduce((s, m) => s + Number(m.amount ?? 0), 0);
  const parts = [
    count("shared") && `${count("shared")} shared`,
    count("asked") && `${count("asked")} asked`,
    count("booked") && `${count("booked")} booked`,
    count("sold") && `${count("sold")} sold`,
    earned > 0 && `$${earned.toLocaleString()}`,
  ].filter(Boolean);

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-baseline justify-between gap-3 text-left">
        <span>
          <span className="section-title">Moves this week</span>
          <span className="ml-3 font-serif text-lg">{parts.length ? <span className="text-clay">{parts.join(" · ")}</span> : <span className="text-muted">none yet</span>}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">{open ? "close" : "see"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <p className="text-sm text-muted">Sharing your work or asking to be paid. Noticed from finished actions, your journal, what you tell your partner, and Instagram posts.</p>
          {list.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {list.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-16 shrink-0 text-xs text-muted">{m.kind}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {m.note || m.kind}
                      {m.amount ? <span className="text-muted"> · ${Number(m.amount).toLocaleString()}</span> : null}
                    </p>
                    {m.source && FROM[m.source] && <p className="text-xs text-muted">{FROM[m.source]}</p>}
                  </div>
                  <RemoveX
                    label="Not a move"
                    action={() => {
                      setList((l) => l.filter((x) => x.id !== m.id));
                      return deleteMove(m.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-xs text-muted">Missed one?</span>
            {KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                aria-pressed={adding === k.kind}
                onClick={() => setAdding(adding === k.kind ? null : k.kind)}
                className={`rounded-full border px-2.5 py-1 text-xs ${adding === k.kind ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          {adding && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                const n = note;
                const a = amount ? Number(amount) : null;
                start(async () => {
                  await addMove(adding, n, a);
                  setNote("");
                  setAmount("");
                  setAdding(null);
                });
              }}
              className="mt-2 flex flex-wrap gap-2"
            >
              <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="What happened?" aria-label="What happened" className="field min-w-0 flex-1" />
              {(adding === "booked" || adding === "sold") && (
                <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="any" min="0" placeholder="$" aria-label="Amount in dollars" className="field w-24" />
              )}
              <button className="btn" disabled={pending || !note.trim()}>Add</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
