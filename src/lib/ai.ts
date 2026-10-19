import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today, WEEKDAYS, weekdayOf } from "./dates";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

export const PARTNER = `You are Lodestar, Max's creative partner and daily guide. Your purpose is to help him live from his highest light: to execute his visions, share his gifts with the world through aligned action, and build sustainable income from that work — without going back to a job.

How you work with him:
- Be direct and honest. He is skeptical of overselling and prefers straight talk, especially about money. Never flatter. If something isn't working, say so plainly and kindly.
- His bottleneck is not ideas or skill; it is discipline, direction, and sharing his work so the right people find it. Bias every suggestion toward finishing, shipping, showing, and asking — not toward more planning or building tools.
- Use process of elimination. Notice what keeps getting skipped, what he released and why, and what actually energizes him in the journal. Help him narrow, not expand. When you suggest dropping something, say why.
- Keep the money path visible. He makes about $3k/month and needs more. Favor actions that move a real person toward paying him (a booking, a sale, a seat at a dinner, a commission) over vanity metrics.
- Be concrete and small. A good suggested task can be done in one sitting and names exactly what "done" looks like.
- Respect his weekly rhythm; suggest work that fits the day, not on top of it.
- On The Creative Act by Rick Rubin: you may draw on its themes (attention, source, the vessel, play, letting go of outcomes, finishing, sharing work) and on passages Max has saved. Never quote the book from memory or invent quotes; only use the exact text of passages he has saved.
- Write in a warm, grounded, plain voice. No hype, no emojis, no therapy-speak.`;

type Row = Record<string, unknown>;
const line = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Everything the partner knows about Max right now, as compact text. */
export async function buildContext(supabase: SupabaseClient, opts: { journalCount?: number } = {}) {
  const day = today();
  const since = addDays(day, -14);
  const [ctx, visions, projects, goals, rhythm, done, skipped, open, journal, ideas, released] = await Promise.all([
    supabase.from("profile_context").select("about_me, summary").maybeSingle(),
    supabase.from("visions").select("title, body, horizon, status").neq("status", "released"),
    supabase.from("projects").select("id, title, description, status, status_note, makes_money").in("status", ["active", "paused"]),
    supabase.from("goals").select("title, metric, target, current, due_date, project_id, status").eq("status", "active"),
    supabase.from("rhythm").select("weekday, title").order("sort"),
    supabase.from("tasks").select("title, completed_at, project_id").eq("status", "done").gte("completed_at", since).order("completed_at", { ascending: false }).limit(40),
    supabase.from("tasks").select("title, day, source").eq("status", "skipped").gte("day", since).limit(20),
    supabase.from("tasks").select("title, day, status").in("status", ["todo"]).limit(30),
    supabase.from("journal_entries").select("day, prompt, body").order("day", { ascending: false }).limit(opts.journalCount ?? 8),
    supabase.from("ideas").select("title, kind, status").in("status", ["new", "exploring", "planned"]).limit(20),
    supabase.from("projects").select("title, status_note").eq("status", "eliminated").limit(20),
  ]);
  const elimIdeas = await supabase.from("ideas").select("title, status_note").eq("status", "eliminated").limit(20);

  const projName = new Map((projects.data ?? []).map((p: Row) => [p.id as string, p.title as string]));
  const todayRhythm = (rhythm.data ?? []).filter((r: Row) => r.weekday === weekdayOf(day)).map((r: Row) => r.title);

  return [
    `Today is ${WEEKDAYS[weekdayOf(day)]}, ${day}.`,
    `## Max in his own words\n${ctx.data?.about_me || "(not written yet)"}`,
    ctx.data?.summary ? `## What you have learned about Max so far\n${ctx.data.summary}` : "",
    `## Visions\n${(visions.data ?? []).map((v: Row) => `- ${v.title} (${v.horizon}): ${line(v.body as string)}`).join("\n") || "(none yet)"}`,
    `## Projects\n${(projects.data ?? []).map((p: Row) => `- ${p.title} [${p.status}${p.makes_money ? ", income" : ""}]: ${line(p.description as string)}${p.status_note ? ` — note: ${line(p.status_note as string)}` : ""}`).join("\n") || "(none)"}`,
    `## Active goals\n${(goals.data ?? []).map((g: Row) => `- ${g.title}${g.metric ? ` — ${g.current}/${g.target ?? "?"} ${g.metric}` : ""}${g.due_date ? ` by ${g.due_date}` : ""}${g.project_id ? ` (${projName.get(g.project_id as string) ?? ""})` : ""}`).join("\n") || "(none)"}`,
    `## Weekly rhythm — today\n${todayRhythm.map((t) => `- ${t}`).join("\n") || "(nothing fixed today)"}`,
    `## Done in the last 2 weeks\n${(done.data ?? []).map((t: Row) => `- ${t.title}`).join("\n") || "(nothing logged)"}`,
    `## Skipped in the last 2 weeks\n${(skipped.data ?? []).map((t: Row) => `- ${t.title} (${t.source})`).join("\n") || "(none)"}`,
    `## Still open\n${(open.data ?? []).map((t: Row) => `- ${t.title}${t.day ? ` (${t.day})` : ""}`).join("\n") || "(none)"}`,
    `## Recent journal entries\n${(journal.data ?? []).map((j: Row) => `### ${j.day}${j.prompt ? ` — prompt: ${line(j.prompt as string)}` : ""}\n${(j.body as string).slice(0, 1500)}`).join("\n\n") || "(no entries yet)"}`,
    `## Ideas in play\n${(ideas.data ?? []).map((i: Row) => `- ${i.title} [${i.kind}, ${i.status}]`).join("\n") || "(none)"}`,
    `## Already eliminated (don't re-suggest without a new reason)\n${[...(released.data ?? []), ...(elimIdeas.data ?? [])].map((r: Row) => `- ${r.title}${r.status_note ? `: ${line(r.status_note as string)}` : ""}`).join("\n") || "(nothing yet)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function ask(opts: { system?: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number }) {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system ?? PARTNER,
    messages: opts.messages,
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Ask for JSON and parse it, tolerating code fences or stray prose around it. */
export async function askJSON<T>(prompt: string, context: string, maxTokens = 1500): Promise<T> {
  const text = await ask({
    maxTokens,
    messages: [{ role: "user", content: `${context}\n\n---\n\n${prompt}\n\nRespond with JSON only, no prose.` }],
  });
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < 0) throw new Error("The partner didn't return usable JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
