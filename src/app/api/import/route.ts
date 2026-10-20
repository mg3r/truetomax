import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ask, askAboutFile } from "@/lib/ai";
import { sameThing, alreadyCovered } from "@/lib/match";
import { today } from "@/lib/dates";
import { readGoogleDoc } from "@/lib/google";
import { remember } from "@/lib/memory";
import { visionText } from "@/lib/vision";

export const maxDuration = 120;

const UNDATED = "9999-12-31";
type Kind = "actions" | "projects" | "visions";

const PROMPTS: Record<Kind, string> = {
  actions: `This is a to-do list (handwritten, typed, or a photo of paper). List every task on it, in order.
For each, say whether it is finished: crossed out, struck through, scribbled over, ticked, or checked off counts as done. Unmarked or an empty box is not done.
Keep each task's wording, cleaned up only enough to read clearly. Skip headings, dates and doodles.
Return only JSON: [{"title": "...", "done": true|false}]`,
  projects: `This is a list or write-up of projects (typed, handwritten, or a photo). Pull out each distinct project with everything written about it.
Keep Max's own wording. Don't invent goals or tasks that aren't there.
- "description": what it is and what it's for, from the text (empty if nothing is said).
- "goals": outcomes he names (what done or success looks like).
- "actions": concrete next steps or tasks; "done": true if crossed out or ticked.
- "status": "done" only if it's clearly finished; "backlog" if he marks it as later or someday; otherwise "active".
Return only JSON: [{"title": "...", "description": "...", "status": "active"|"backlog"|"done", "goals": ["..."], "actions": [{"title": "...", "done": false}]}]`,
  visions: `This is Max's own writing about his vision (notes, a doc, or a photo of a page). Split it into separate concepts or sections, the way he grouped them (use his headings when there are some).
Keep his exact words: don't summarize, rewrite, or add anything. Keep his bullets and numbered lists as lists.
For each section give "title" (his heading, or a few of his own words that name it) and "body" as simple HTML using only <p>, <h3>, <ul>, <ol>, <li>, <strong>.
Return only JSON: [{"title": "...", "body": "<p>...</p>"}]`,
};

function parse<T>(text: string): T[] {
  const s = text.indexOf("[");
  const e = text.lastIndexOf("]");
  if (s < 0 || e < 0) return [];
  try {
    return JSON.parse(text.slice(s, e + 1)) as T[];
  } catch {
    return [];
  }
}

/** One import for everything: paste text, a Google Doc link, a file, or a photo. The partner reads it and adds what's there. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData();
  const kind = (["actions", "projects", "visions"].includes(String(form.get("kind"))) ? form.get("kind") : "actions") as Kind;
  const projectId = (form.get("project_id") as string) || null;
  let text = typeof form.get("text") === "string" ? (form.get("text") as string) : "";
  const link = typeof form.get("link") === "string" ? (form.get("link") as string).trim() : "";
  const file = form.get("file");

  try {
    // A Google Doc link: read the whole doc, every tab.
    if (!text.trim() && link) {
      const id = link.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1];
      if (!id) return NextResponse.json({ error: "That doesn't look like a Google Docs link. Open the doc and copy the link from the address bar." }, { status: 400 });
      const doc = await readGoogleDoc(supabase, id);
      if ("error" in doc) return NextResponse.json({ error: doc.error }, { status: 400 });
      text = doc.text;
    }

    let reply: string;
    if (text.trim()) {
      reply = await ask({ system: "You read Max's lists and notes precisely and keep his words.", messages: [{ role: "user", content: `${PROMPTS[kind]}\n\nThe text:\n"""\n${text.slice(0, 60000)}\n"""` }], maxTokens: 8000 });
    } else if (file instanceof File) {
      const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(type)) {
        return NextResponse.json({ error: "Use a photo (JPG or PNG), a PDF, or a Word or text file." }, { status: 400 });
      }
      reply = await askAboutFile({ prompt: PROMPTS[kind], mediaType: type, data: Buffer.from(await file.arrayBuffer()).toString("base64"), maxTokens: 8000 });
    } else {
      return NextResponse.json({ error: "Paste some text, a link, or choose a file first." }, { status: 400 });
    }

    const result = kind === "actions" ? await importActions(supabase, parse(reply), projectId) : kind === "projects" ? await importProjects(supabase, parse(reply)) : await importVisions(supabase, parse(reply));
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that." }, { status: 502 });
  }
}

type SB = Awaited<ReturnType<typeof createClient>>;

async function importActions(supabase: SB, items: { title: string; done: boolean }[], projectId: string | null) {
  const list = items.filter((i) => typeof i?.title === "string" && i.title.trim());
  if (!list.length) return { note: "Couldn't find any actions in that." };
  // Check titles and notes: something you already wrote into an action's notes isn't added again.
  const { data: existing } = await supabase.from("tasks").select("id, title, status, reason").in("status", ["todo", "done"]).neq("source", "rhythm");
  const now = new Date().toISOString();
  let added = 0, finished = 0, already = 0;
  const fresh: Record<string, unknown>[] = [];
  for (const item of list) {
    const match = (existing ?? []).find((t) => sameThing(t.title, item.title)) ?? (existing ?? []).find((t) => alreadyCovered(item.title, t));
    if (match) {
      // Crossing something off that lives only in another action's notes doesn't finish that action.
      if (item.done && match.status !== "done" && sameThing(match.title, item.title)) {
        await supabase.from("tasks").update({ status: "done", completed_at: now }).eq("id", match.id);
        finished++;
      } else already++;
      continue;
    }
    fresh.push({ title: item.title.trim().slice(0, 300), project_id: projectId, day: item.done ? today() : UNDATED, status: item.done ? "done" : "todo", completed_at: item.done ? now : null });
    if (item.done) finished++;
    else added++;
  }
  if (fresh.length) await supabase.from("tasks").insert(fresh);
  return { note: [added && `${added} added to Up next`, finished && `${finished} crossed off`, already && `${already} already here`].filter(Boolean).join(", ") || "Nothing new on that list." };
}

async function importProjects(supabase: SB, items: { title: string; description?: string; status?: string; goals?: string[]; actions?: { title: string; done?: boolean }[] }[]) {
  const list = items.filter((i) => typeof i?.title === "string" && i.title.trim());
  if (!list.length) return { note: "Couldn't find any projects in that." };
  const { data: existing } = await supabase.from("projects").select("id, title, description");
  const now = new Date().toISOString();
  let created = 0, updated = 0, goalCount = 0, actionCount = 0;
  for (const p of list) {
    const status = p.status === "done" ? "done" : p.status === "backlog" ? "paused" : "active";
    let id = (existing ?? []).find((x) => sameThing(x.title, p.title))?.id;
    if (id) {
      updated++;
      const cur = (existing ?? []).find((x) => x.id === id);
      if (p.description && !cur?.description) await supabase.from("projects").update({ description: p.description }).eq("id", id);
    } else {
      const { data } = await supabase.from("projects").insert({ title: p.title.trim().slice(0, 200), description: p.description ?? "", status }).select("id").single();
      id = data?.id;
      created++;
    }
    if (!id) continue;
    const goals = (p.goals ?? []).filter((g) => typeof g === "string" && g.trim());
    if (goals.length) {
      const { data: have } = await supabase.from("goals").select("title").eq("project_id", id);
      const add = goals.filter((g) => !(have ?? []).some((h) => sameThing(h.title, g)));
      if (add.length) await supabase.from("goals").insert(add.map((title) => ({ project_id: id, title: title.trim() })));
      goalCount += add.length;
    }
    const acts = (p.actions ?? []).filter((a) => typeof a?.title === "string" && a.title.trim());
    if (acts.length) {
      const { data: have } = await supabase.from("tasks").select("title, reason").neq("source", "rhythm").in("status", ["todo", "done"]);
      const add = acts.filter((a) => !(have ?? []).some((h) => alreadyCovered(a.title, h)));
      if (add.length)
        await supabase.from("tasks").insert(
          add.map((a) => ({ title: a.title.trim().slice(0, 300), project_id: id, day: a.done ? today() : UNDATED, status: a.done ? "done" : "todo", completed_at: a.done ? now : null }))
        );
      actionCount += add.length;
    }
  }
  return {
    note: [created && `${created} project${created === 1 ? "" : "s"} added`, updated && `${updated} already here (added to them)`, goalCount && `${goalCount} goals`, actionCount && `${actionCount} actions`].filter(Boolean).join(", "),
  };
}

async function importVisions(supabase: SB, items: { title: string; body?: string }[]) {
  const list = items.filter((i) => typeof i?.title === "string" && i.title.trim());
  if (!list.length) return { note: "Couldn't find anything to add to your vision." };
  // New sections go on top, in the order they were written.
  const { data: first } = await supabase.from("visions").select("sort").order("sort").limit(1).maybeSingle();
  const top = (first?.sort ?? 0) - list.length;
  const clean = (html: string) => html.replace(/<(?!\/?(p|h3|ul|ol|li|strong)\b)[^>]*>/g, "");
  const { data: rows } = await supabase
    .from("visions")
    .insert(list.map((v, i) => ({ title: v.title.trim().slice(0, 200), body: clean(v.body ?? ""), sort: top + i })))
    .select("id, title, body");
  // The partner reads your vision from now on, like anything you write there yourself.
  for (const v of rows ?? []) await remember(supabase, "vision", v.id, `Vision: ${v.title}. ${visionText(v.body ?? "")}`).catch(() => {});
  return { note: `${list.length} section${list.length === 1 ? "" : "s"} added to the top of your vision` };
}
