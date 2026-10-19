"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; role: "user" | "assistant"; content: string; kind: string };

/** Light formatting for partner replies: paragraphs, bullet lines and **bold**. */
function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((block, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {block.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part.replace(/^#+\s*/gm, "")
          )}
        </p>
      ))}
    </div>
  );
}

export function Chat({ initial }: { initial: Msg[] }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "chat" | "focus">(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setError(null);
    setDraft("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text, kind: "chat" }]);
    setBusy("chat");
    const res = await fetch("/api/partner", { method: "POST", body: JSON.stringify({ message: text }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "Your partner didn't answer. Try again.");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: json.reply, kind: "chat" }]);
    router.refresh();
  }

  async function focusReview() {
    setError(null);
    setBusy("focus");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: "Run a focus review.", kind: "focus_review" }]);
    const res = await fetch("/api/focus", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "The review didn't finish. Try again.");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: json.reply, kind: "focus_review" }]);
  }

  return (
    <div>
      <div className="space-y-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-bg">{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className={`max-w-[65ch] font-serif text-[1.075rem] leading-relaxed ${m.kind === "focus_review" ? "border-l-2 border-dawn pl-4" : ""}`}>
              <Prose text={m.content} />
            </div>
          )
        )}
        {busy && <p className="text-sm text-muted motion-safe:animate-pulse">{busy === "focus" ? "Reviewing everything you've logged…" : "Thinking…"}</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div ref={end} />
      </div>

      <div className="sticky bottom-16 mt-6 bg-bg pt-3 pb-2 sm:bottom-0">
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={2}
            placeholder="Ask, think out loud, or tell it what happened today"
            aria-label="Message your partner"
            className="field !font-sans !text-base"
          />
          <button className="btn" disabled={!!busy || !draft.trim()}>Send</button>
        </form>
        <button onClick={focusReview} disabled={!!busy} className="mt-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink">
          Run a focus review: what to keep, pause, or eliminate
        </button>
      </div>
    </div>
  );
}
