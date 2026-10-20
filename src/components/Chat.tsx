"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteConversation } from "@/app/actions";
import { RemoveX } from "./RemoveX";

type Msg = { id: string; role: "user" | "assistant"; content: string; kind: string; created_at?: string };
export type Conversation = { id: string; title: string; updated_at: string };

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

// Shown in your own time zone. The server renders in its zone, so these opt out of the hydration check.
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const shortLabel = (iso: string) => {
  const d = new Date(iso);
  return dayKey(iso) === dayKey(new Date().toISOString()) ? timeLabel(iso) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const href = (id: string | null) => `/context?tab=partner&c=${id ?? "new"}`;

export function Chat({ initial, conversations, current, threads }: { initial: Msg[]; conversations: Conversation[]; current: string | null; threads: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<null | "chat" | "focus">(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState(current);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);

  // A new conversation gets its id from the first reply; put it in the address so the sidebar picks it up.
  function settle(id: string | null) {
    if (id && id !== convId) {
      setConvId(id);
      router.replace(href(id), { scroll: false });
    } else router.refresh();
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setError(null);
    setDraft("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: text, kind: "chat", created_at: new Date().toISOString() }]);
    setBusy("chat");
    const res = await fetch("/api/partner", { method: "POST", body: JSON.stringify({ message: text, conversationId: convId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "Your partner didn't answer. Try again.");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: json.reply, kind: "chat", created_at: json.repliedAt ?? new Date().toISOString() }]);
    settle(json.conversationId ?? null);
  }

  async function focusReview() {
    setError(null);
    setBusy("focus");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: "Run a focus review.", kind: "focus_review", created_at: new Date().toISOString() }]);
    const res = await fetch("/api/focus", { method: "POST", body: JSON.stringify({ conversationId: convId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(json.error ?? "The review didn't finish. Try again.");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: json.reply, kind: "focus_review", created_at: json.repliedAt ?? new Date().toISOString() }]);
    settle(json.conversationId ?? null);
  }

  return (
    <div>
      {threads && (
        <div className="mb-6 flex items-center justify-between gap-3 text-sm">
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-muted hover:text-ink" aria-expanded={open} aria-controls="conversations">
            <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
              <path d="M1 1h12M1 5h12M1 9h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Conversations
          </button>
          {(convId || messages.length > 0) && (
            <Link href={href(null)} className="btn-quiet !px-3 !py-1 text-xs">
              New conversation
            </Link>
          )}
        </div>
      )}

      {open && <Sidebar conversations={conversations} current={convId} onClose={() => setOpen(false)} />}

      <div className="space-y-5">
        {messages.map((m, i) => {
          const at = m.created_at;
          const newDay = at && (i === 0 || !messages[i - 1].created_at || dayKey(messages[i - 1].created_at!) !== dayKey(at));
          return (
            <div key={m.id}>
              {newDay && (
                <p suppressHydrationWarning className="mb-5 text-center text-xs text-muted">
                  {dayLabel(at)}
                </p>
              )}
              {m.role === "user" ? (
                <div className="flex flex-col items-end">
                  <p className="max-w-[85%] pebble rounded-br-md bg-ink px-4 py-2.5 whitespace-pre-wrap text-bg">{m.content}</p>
                  {at && <time suppressHydrationWarning dateTime={at} className="mt-1 text-[0.7rem] text-muted">{timeLabel(at)}</time>}
                </div>
              ) : (
                <div className={`max-w-[65ch] font-serif text-[1.075rem] leading-relaxed ${m.kind === "focus_review" ? "border-l border-ink pl-4" : ""}`}>
                  <Prose text={m.content} />
                  {at && <time suppressHydrationWarning dateTime={at} className="mt-1 block font-sans text-[0.7rem] text-muted">{timeLabel(at)}</time>}
                </div>
              )}
            </div>
          );
        })}
        {!messages.length && !busy && <p className="text-muted">A fresh conversation. Ask, think out loud, or tell it what happened today.</p>}
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

/** Every past conversation, newest first. Slides in from the left. */
function Sidebar({ conversations, current, onClose }: { conversations: Conversation[]; current: string | null; onClose: () => void }) {
  const router = useRouter();
  const [list, setList] = useState(conversations);
  useEffect(() => setList(conversations), [conversations]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <button aria-label="Close conversations" onClick={onClose} className="absolute inset-0 bg-ink/20" />
      <aside id="conversations" aria-label="Conversations" className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-line bg-bg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-serif text-xl">Conversations</h2>
          <RemoveX label="Close" action={onClose} />
        </div>
        <div className="px-5 pb-3">
          <Link href={href(null)} onClick={onClose} className="btn w-full justify-center">
            New conversation
          </Link>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-24">
          {list.map((c) => (
            <li key={c.id} className={`group flex items-center gap-1 rounded-lg ${c.id === current ? "bg-surface" : "hover:bg-surface"}`}>
              <Link href={href(c.id)} onClick={onClose} className="min-w-0 flex-1 px-3 py-2.5">
                <span className="block truncate">{c.title}</span>
                <span suppressHydrationWarning className="block text-xs text-muted">{shortLabel(c.updated_at)}</span>
              </Link>
              <RemoveX
                label={`Delete ${c.title}`}
                confirm={`Delete "${c.title}"? What your partner learned from it stays.`}
                className="mr-1 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                action={async () => {
                  setList((l) => l.filter((x) => x.id !== c.id));
                  await deleteConversation(c.id);
                  if (c.id === current) router.replace(href(null));
                }}
              />
            </li>
          ))}
          {!list.length && <li className="px-3 py-2 text-sm text-muted">No conversations yet.</li>}
        </ul>
      </aside>
    </div>
  );
}
