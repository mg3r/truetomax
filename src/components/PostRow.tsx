"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Thumb } from "./Thumb";
import { type Post, formatOf, rateOf, skipPct } from "@/lib/socials";

const n = (v: number | null | undefined) => (v == null ? "–" : v >= 10000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : v.toLocaleString());
const pct = (v: number | null) => (v == null ? null : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
const secs = (ms: number | null | undefined) => (ms == null ? null : `${(ms / 1000).toFixed(1)}s`);
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "");

/** One post: tap the picture or caption to open it on Instagram; tap "What it saw" to see everything the partner noticed, and every number. */
export function PostRow({ m, best }: { m: Post; best: boolean }) {
  const [open, setOpen] = useState(false);
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();
  const lookNow = async () => {
    setLooking(true);
    setNote(null);
    const res = await fetch("/api/socials/look", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.media_id }) }).catch(() => null);
    if (res?.ok) router.refresh();
    else setNote((await res?.json().catch(() => null))?.error ?? "Couldn't look at it just now.");
    setLooking(false);
  };
  const reel = m.product_type === "REELS";
  const d = m.seen_detail;
  const skip = skipPct(m.skip_rate);

  const more: [string, string | null][] = [
    ["Avg watch", m.avg_watch_ms != null ? `${secs(m.avg_watch_ms)}${m.duration_s ? ` of ${Math.round(m.duration_s)}s` : ""}` : null],
    ["Watched through", m.avg_watch_ms != null && m.duration_s ? pct(Math.min(100, m.avg_watch_ms / 10 / m.duration_s)) : null],
    ["Skip rate", pct(skip)],
    ["Total watch time", m.watch_ms != null ? (m.watch_ms >= 3_600_000 ? `${(m.watch_ms / 3_600_000).toFixed(1)}h` : `${Math.round(m.watch_ms / 60000)}m`) : null],
    ["Share rate", pct(rateOf(m.shares, m.reach))],
    ["Save rate", pct(rateOf(m.saves, m.reach))],
    ["Engagement", pct(rateOf(m.interactions ?? (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0), m.reach))],
    ["Interactions", m.interactions != null ? n(m.interactions) : null],
    ["Reposts", m.reposts != null ? n(m.reposts) : null],
    ["Follows", m.follows != null ? n(m.follows) : null],
    ["Profile visits", m.profile_visits != null ? n(m.profile_visits) : null],
  ];
  const shown = more.filter(([, v]) => v != null) as [string, string][];

  return (
    <li className="py-4">
      <div className="flex gap-4">
        <a href={m.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="h-20 w-16 shrink-0 overflow-hidden rounded-md" aria-label="Open on Instagram">
          <Thumb src={m.thumb_url} alt="" />
        </a>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {shortDate(m.posted_at)} · {formatOf(m)}
            {best && <span className="ml-2 text-ink">best so far</span>}
          </p>
          <a href={m.permalink ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-0.5 line-clamp-2 hover:underline hover:decoration-line hover:underline-offset-4">
            {m.caption?.trim() || "(no caption)"}
          </a>
          {m.seen && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 block w-full text-left text-xs text-muted italic hover:text-ink">
              <span className={open ? "" : "line-clamp-2"}>{m.seen}</span>
            </button>
          )}
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
            {m.views != null && <span>{n(m.views)} views</span>}
            <span>{n(m.reach)} reach</span>
            <span>{n(m.likes)} likes</span>
            <span>{n(m.comments)} comments</span>
            <span>{n(m.saves)} saves</span>
            <span>{n(m.shares)} shares</span>
            {reel && m.avg_watch_ms != null && <span>{secs(m.avg_watch_ms)} avg watch</span>}
            {reel && skip != null && <span>{pct(skip)} skip</span>}
          </p>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1.5 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">
            {open ? "Less" : "What it saw"}
          </button>

          {open && (
            <div className="mt-3 space-y-4 border-l border-line pl-3 text-sm">
              {!m.seen && (
                <div className="space-y-2">
                  <p className="text-muted">{looking ? "Looking at every slide and frame… this can take a minute." : "Your partner hasn\u2019t looked at this one yet."}</p>
                  {!looking && (
                    <button type="button" onClick={lookNow} className="rounded-full border border-ink px-3 py-1 text-xs text-ink hover:bg-ink hover:text-bg">
                      Look at it now
                    </button>
                  )}
                  {note && <p role="status" className="text-xs text-muted">{note}</p>}
                </div>
              )}
              {d?.takeaway && (
                <div>
                  <h4 className="text-xs text-muted">What it learned</h4>
                  <p className="mt-0.5 font-serif text-base leading-relaxed">{d.takeaway}</p>
                </div>
              )}
              {m.seen && (
                <div>
                  <h4 className="text-xs text-muted">What&rsquo;s in it</h4>
                  <p className="mt-0.5">{m.seen}</p>
                </div>
              )}
              {d?.watched && <p className="text-xs text-muted">{d.watched}</p>}
              {d?.hook && (
                <div>
                  <h4 className="text-xs text-muted">Opens with</h4>
                  <p className="mt-0.5">{d.hook}</p>
                </div>
              )}
              {d?.parts?.length ? (
                <div>
                  <h4 className="text-xs text-muted">{reel ? "Moment by moment" : d.parts.length > 1 ? "Slide by slide" : "What's in it"}</h4>
                  <ol className="mt-1 space-y-1.5">
                    {d.parts.map((p, i) => (
                      <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-2">
                        <span className="text-xs text-muted tabular-nums">{p.label}</span>
                        <span>{p.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {d?.on_screen_text && (
                <div>
                  <h4 className="text-xs text-muted">Text on screen</h4>
                  <p className="mt-0.5 whitespace-pre-line">{d.on_screen_text}</p>
                </div>
              )}
              {shown.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {shown.map(([label, value]) => (
                    <div key={label} className="flex flex-col-reverse">
                      <dt className="text-xs text-muted">{label}</dt>
                      <dd className="tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {!d && m.seen && (
                <p className="text-xs text-muted">
                  This is from an earlier, quicker look.{" "}
                  <button type="button" onClick={lookNow} disabled={looking} className="underline decoration-line underline-offset-4 hover:text-ink">
                    {looking ? "Looking…" : "Look again, all of it"}
                  </button>
                  {note && <span className="ml-2">{note}</span>}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
