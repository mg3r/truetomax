import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today, WEEKDAYS, weekdayOf } from "./dates";
import { getStats } from "./learn";
import { recall, recallDocs } from "./memory";
import { instagramContext } from "./instagram";
import { APP_NAME } from "@/lib/brand";
import { visionText } from "./vision";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

export const PARTNER = `You are Max's creative partner and daily guide inside ${APP_NAME}, his personal app. Your purpose is to help him live from his highest light: to execute his visions, share his gifts with the world through aligned action, and build sustainable income from that work — without going back to a job.

How you work with him:
- Be direct and honest. He is skeptical of overselling and prefers straight talk, especially about money. Never flatter. If something isn't working, say so plainly and kindly.
- His bottleneck is not ideas or skill; it is discipline, direction, and sharing his work so the right people find it. Bias every suggestion toward finishing, shipping, showing, and asking — not toward more planning or building tools.
- Use process of elimination. Notice what keeps getting skipped, what he released and why, and what actually energizes him in the journal. Help him narrow, not expand. When you suggest dropping something, say why.
- Keep the money path visible. He makes about $3k/month; his near-term target is $10k a month from his gifts by next summer. Favor actions that move a real person toward paying him (a booking, a sale, a seat at a dinner, a commission) over vanity metrics.
- Be concrete and small. A good suggested task can be done in one sitting and names exactly what "done" looks like.
- Respect his weekly rhythm; suggest work that fits the day, not on top of it.
- You evolve with him. What he has confirmed about himself, the results of past suggestions, and your current guidance policy override your general instincts. Do more of what he actually follows through on; resize or reframe what he keeps skipping instead of repeating it.
- His Vision page is a living doc in his own words. Help him understand what he actually wants: when it's thin, vague or seems out of date, ask him about it. Never fill it in for him.
- His most important number is moves: times per week he shares his work or asks someone to pay him. Protect at least one move in most days' plans.
- On The Creative Act by Rick Rubin: you may draw on its themes (attention, source, the vessel, play, letting go of outcomes, finishing, sharing work) and on passages Max has saved. Never quote the book from memory or invent quotes; only use the exact text of passages he has saved.
- Write in a warm, grounded, plain voice. No hype, no emojis, no therapy-speak.`;

type Row = Record<string, unknown>;
const line = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Everything the partner knows about Max right now, as compact text. */
export async function buildContext(
  supabase: SupabaseClient,
  opts: { journalCount?: number; query?: string; skipLearned?: boolean } = {}
) {
  const learned = opts.skipLearned ? "" : await learnedContext(supabase, opts.query);
  // The parts of his docs that bear on what's being asked or planned, from anywhere in them, however long.
  const passages = opts.query ? await recallDocs(supabase, opts.query, 6) : [];
  const docPassages = passages.length ? `## Passages from his docs that bear on this (his own words)\n${passages.map((p) => `- ${p.content.replace(/\s+/g, " ").slice(0, 1600)}`).join("\n")}` : "";
  return [await baseContext(supabase, opts), docPassages, learned].filter(Boolean).join("\n\n");
}

/** What the partner has learned and the results that taught it — this is what makes it evolve. */
async function learnedContext(supabase: SupabaseClient, query?: string) {
  const day = today();
  const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7)); // Monday
  const [insights, ctx, moves, stats, memories, instagram] = await Promise.all([
    supabase.from("insights").select("statement, status, confidence, your_note, kind").in("status", ["confirmed", "proposed", "rejected"]).order("confidence", { ascending: false }),
    supabase.from("profile_context").select("policy").maybeSingle(),
    supabase.from("moves").select("kind, amount").gte("day", weekStart),
    getStats(supabase, 28),
    query ? recall(supabase, query, { count: 6, beforeDay: addDays(day, -14) }) : Promise.resolve([]),
    instagramContext(supabase).catch(() => ""),
  ]);
  const ins = insights.data ?? [];
  const pick = (s: string) => ins.filter((i) => i.status === s);
  const policy = (ctx.data?.policy ?? {}) as Record<string, unknown>;
  const mv = moves.data ?? [];
  const count = (k: string) => mv.filter((m) => m.kind === k).length;
  const money = mv.reduce((s, m) => s + Number(m.amount ?? 0), 0);

  return [
    pick("confirmed").length ? `## What you've learned about Max (he confirmed these — act on them)\n${pick("confirmed").map((i) => `- ${i.statement}${i.your_note ? ` (his note: ${i.your_note})` : ""}`).join("\n")}` : "",
    pick("proposed").length ? `## Working hypotheses (not yet confirmed — weigh by confidence)\n${pick("proposed").map((i) => `- ${i.statement} (confidence ${i.confidence})`).join("\n")}` : "",
    pick("rejected").length ? `## Max said these are wrong — do not act on them\n${pick("rejected").map((i) => `- ${i.statement}${i.your_note ? ` (his correction: ${i.your_note})` : ""}`).join("\n")}` : "",
    Object.keys(policy).length ? `## How to guide him right now (tuned from results)\n${JSON.stringify(policy)}` : "",
    `## Results, last 4 weeks\n${stats.text}`,
    `## Moves this week (sharing work or asking to be paid — the number that matters most)\nShared ${count("shared")}, asked ${count("asked")}, booked ${count("booked")}, sold ${count("sold")}, $${money} in.`,
    instagram,
    memories.length ? `## Relevant memories from further back\n${memories.map((m) => `- ${m.day} [${m.source_type}] ${line(m.content).slice(0, 400)}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function baseContext(supabase: SupabaseClient, opts: { journalCount?: number }) {
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
  const [routineRows, routineChecks] = await Promise.all([
    supabase.from("routines").select("*").order("sort"),
    supabase.from("routine_checks").select("routine_id").gte("day", since),
  ]);
  const routineCount = new Map<string, number>();
  for (const c of routineChecks.data ?? []) routineCount.set(c.routine_id as string, (routineCount.get(c.routine_id as string) ?? 0) + 1);
  const routineText = (routineRows.data ?? [])
    .map((r: Row) => {
      const pinned = r.cadence === "weekly" && (r.weekdays as number[]).length > 0;
      const times = pinned ? (r.weekdays as number[]).length : Math.max(1, Number(r.times_per_week ?? 1));
      const days = r.cadence !== "weekly" ? "" : pinned ? ` on ${(r.weekdays as number[]).map((w) => WEEKDAYS[w].slice(0, 3)).join(", ")}` : `, ${times}× a week on any day, not a scheduled event`;
      const possible = r.cadence === "weekly" ? times * 2 : 14;
      return `- ${r.title} (${r.kind === "practice" ? "practice" : "ritual"}, ${r.cadence}${days}) — done ${routineCount.get(r.id as string) ?? 0} of ${possible} times in the last 2 weeks`;
    })
    .join("\n");
  // Practices (Rhythm items marked as practices): what he makes and offers, and how often he does it. They may or may not serve a project.
  const [practiceLinks, practiceChecks] = await Promise.all([
    supabase.from("routine_projects").select("routine_id, project_id"),
    supabase.from("routine_checks").select("routine_id, day").gte("day", addDays(day, -28)),
  ]);
  const practiceText = practiceLinks.error
    ? ""
    : (routineRows.data ?? [])
        .filter((r: Row) => r.kind === "practice")
        .map((p: Row) => {
          const ds = (practiceChecks.data ?? []).filter((x: Row) => x.routine_id === p.id).map((x: Row) => x.day as string).sort();
          return `- ${p.title}: ${ds.length}× in the last 4 weeks${ds.length ? `, last ${ds[ds.length - 1]}` : ", not done yet"}`;
        })
        .join("\n");
  const elimIdeas = await supabase.from("ideas").select("title, status_note").eq("status", "eliminated").limit(20);
  // His own docs (vision, routine, plans, coaching notes). Most recently updated first, capped so they don't crowd out the rest.
  const docs = await supabase.from("context_docs").select("title, text, updated_at").order("updated_at", { ascending: false }).limit(12);
  let docBudget = 20000;
  const docText = (docs.error ? [] : docs.data ?? [])
    .map((d: Row) => {
      const take = Math.max(0, Math.min(5000, docBudget));
      docBudget -= take;
      return take ? `### ${d.title}\n${(d.text as string).slice(0, take)}${(d.text as string).length > take ? "\n[…]" : ""}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const projName = new Map((projects.data ?? []).map((p: Row) => [p.id as string, p.title as string]));
  const todayRhythm = (rhythm.data ?? []).filter((r: Row) => r.weekday === weekdayOf(day)).map((r: Row) => r.title);

  return [
    `Today is ${WEEKDAYS[weekdayOf(day)]}, ${day}.`,
    `## Max in his own words\n${ctx.data?.about_me || "(not written yet)"}`,
    ctx.data?.summary ? `## What you have learned about Max so far\n${ctx.data.summary}` : "",
    `## Vision (his own page, in his words: what's alive for him and where he's going)\n${(visions.data ?? []).map((v: Row) => `### ${v.title}\n${visionText((v.body as string) ?? "").slice(0, 3000)}`).join("\n\n") || "(none yet)"}`,
    docText ? `## His own docs (written by him; the opening of each — the most relevant passages from anywhere in them follow below; use them for context, suggestions and questions)\n${docText}` : "",
    `## Projects (the live list right now; anything not here was deleted or never existed)\n${(projects.data ?? []).map((p: Row) => `- ${p.title} [${p.status}${p.makes_money ? ", income" : ""}]: ${line(p.description as string)}${p.status_note ? ` — note: ${line(p.status_note as string)}` : ""}`).join("\n") || "(none)"}`,
    `## Active goals\n${(goals.data ?? []).map((g: Row) => `- ${g.title}${g.metric ? ` — ${g.current}/${g.target ?? "?"} ${g.metric}` : ""}${g.due_date ? ` by ${g.due_date}` : ""}${g.project_id ? ` (${projName.get(g.project_id as string) ?? ""})` : ""}`).join("\n") || "(none)"}`,
    `## Weekly rhythm — today\n${todayRhythm.map((t) => `- ${t}`).join("\n") || "(nothing fixed today)"}`,
    `## Rhythm (what he does on repeat, set by him: rituals keep him grounded and regulated, practices are what he makes and offers; notice what's holding and what's slipping)\n${routineText || "(none set)"}`,
    practiceText ? `## Practices (what he makes and offers; worth doing for their own sake, whether or not they serve a project; build suggestions and sharing ideas around them, and notice which have gone quiet)\n${practiceText}` : "",
    `## Done in the last 2 weeks\n${(done.data ?? []).map((t: Row) => `- ${t.title}`).join("\n") || "(nothing logged)"}`,
    `## Skipped in the last 2 weeks\n${(skipped.data ?? []).map((t: Row) => `- ${t.title} (${t.source})`).join("\n") || "(none)"}`,
    `## Still open tasks (live list)\n${(open.data ?? []).map((t: Row) => `- ${t.title}${t.day ? ` (${t.day})` : ""}`).join("\n") || "(none)"}`,
    `## Recent journal entries\n${(journal.data ?? []).map((j: Row) => `### ${j.day}${j.prompt ? ` — prompt: ${line(j.prompt as string)}` : ""}\n${(j.body as string).slice(0, 1500)}`).join("\n\n") || "(no entries yet)"}`,
    `## Ideas in play\n${(ideas.data ?? []).map((i: Row) => `- ${i.title} [${i.kind}, ${i.status}]`).join("\n") || "(none)"}`,
    `## Already eliminated (don't re-suggest without a new reason)\n${[...(released.data ?? []), ...(elimIdeas.data ?? [])].map((r: Row) => `- ${r.title}${r.status_note ? `: ${line(r.status_note as string)}` : ""}`).join("\n") || "(nothing yet)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Read a picture or PDF and answer about it. The file arrives as base64. */
export async function askAboutFile(opts: { prompt: string; mediaType: string; data: string; maxTokens?: number }) {
  const file =
    opts.mediaType === "application/pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: opts.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: opts.data } } as const);
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    messages: [{ role: "user", content: [file, { type: "text", text: opts.prompt }] }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Look at a few images (JPEG/PNG/WebP, as base64) and answer about them. */
export async function askAboutImages(opts: { prompt: string; images: { mediaType: string; data: string }[]; maxTokens?: number }) {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 400,
    messages: [
      {
        role: "user",
        content: [
          ...opts.images.map((im) => ({ type: "image" as const, source: { type: "base64" as const, media_type: im.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: im.data } })),
          { type: "text" as const, text: opts.prompt },
        ],
      },
    ],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Look at a sequence of labelled pictures (slides, video frames) and answer about them. */
export async function askAboutSequence(opts: { prompt: string; parts: ({ text: string } | { mediaType: string; data: string })[]; maxTokens?: number }) {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    messages: [
      {
        role: "user",
        content: [
          ...opts.parts.map((p) =>
            "text" in p
              ? { type: "text" as const, text: p.text }
              : { type: "image" as const, source: { type: "base64" as const, media_type: p.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: p.data } }
          ),
          { type: "text" as const, text: opts.prompt },
        ],
      },
    ],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
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
function parseJSON<T>(text: string): T {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < 0) throw new Error("no JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function askJSON<T>(prompt: string, context: string, maxTokens = 4000): Promise<T> {
  const text = await ask({
    maxTokens,
    messages: [{ role: "user", content: `${context}\n\n---\n\n${prompt}\n\nRespond with valid JSON only, no prose. Escape any double quotes inside strings.` }],
  });
  try {
    return parseJSON<T>(text);
  } catch {
    // Occasionally the reply has a stray quote or gets cut short. Ask once for a clean copy.
    const fixed = await ask({
      maxTokens,
      messages: [{ role: "user", content: `Fix this so it is valid JSON with the same content. If it was cut off, close it after the last complete item. Return only the JSON.\n\n${text}` }],
    });
    try {
      return parseJSON<T>(fixed);
    } catch {
      throw new Error("Your partner's answer came back garbled. Try again.");
    }
  }
}
