import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ask, askAboutFile } from "@/lib/ai";
import { sameThing } from "@/lib/match";
import { today } from "@/lib/dates";

export const maxDuration = 120;

type Item = { title: string; done: boolean };

const PROMPT = `This is a to-do list (handwritten, typed, or a photo of paper). List every task on it, in order.
For each, say whether it is finished: crossed out, struck through, scribbled over, ticked, or checked off counts as done. Unmarked or an empty box is not done.
Keep each task's wording, cleaned up only enough to read clearly (fix obvious spelling, expand nothing). Skip headings, dates and doodles.
Return only JSON: [{"title": "...", "done": true|false}]`;

function parse(text: string): Item[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0) return [];
  try {
    const items = JSON.parse(text.slice(start, end + 1)) as Item[];
    return items.filter((i) => typeof i?.title === "string" && i.title.trim()).map((i) => ({ title: i.title.trim().slice(0, 300), done: !!i.done }));
  } catch {
    return [];
  }
}

/** Read a list from a photo, PDF or text and add its tasks; anything crossed off is marked done (including tasks you already had). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData();
  const projectId = (form.get("project_id") as string) || null;
  const text = form.get("text");
  const file = form.get("file");

  try {
    let reply: string;
    if (typeof text === "string" && text.trim()) {
      reply = await ask({ system: "You read to-do lists precisely.", messages: [{ role: "user", content: `${PROMPT}\n\nThe list:\n${text.slice(0, 20000)}` }], maxTokens: 4000 });
    } else if (file instanceof File) {
      const type = file.type === "image/jpg" ? "image/jpeg" : file.type;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"].includes(type)) {
        return NextResponse.json({ error: "Use a photo (JPG or PNG), a PDF, or a Word or text file." }, { status: 400 });
      }
      const data = Buffer.from(await file.arrayBuffer()).toString("base64");
      reply = await askAboutFile({ prompt: PROMPT, mediaType: type, data });
    } else {
      return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
    }

    const items = parse(reply);
    if (!items.length) return NextResponse.json({ error: "Couldn't find any actions in that. Try a clearer photo." }, { status: 422 });

    // Match against what you already have, so importing the same list twice doesn't double it.
    const { data: existing } = await supabase.from("tasks").select("id, title, status").in("status", ["todo", "done"]).neq("source", "rhythm");
    const now = new Date().toISOString();
    let added = 0;
    let finished = 0;
    let already = 0;
    const fresh: Record<string, unknown>[] = [];
    for (const item of items) {
      const match = (existing ?? []).find((t) => sameThing(t.title, item.title));
      if (match) {
        if (item.done && match.status !== "done") {
          await supabase.from("tasks").update({ status: "done", completed_at: now }).eq("id", match.id);
          finished++;
        } else already++;
        continue;
      }
      fresh.push({
        title: item.title,
        project_id: projectId,
        day: item.done ? today() : "9999-12-31",
        status: item.done ? "done" : "todo",
        completed_at: item.done ? now : null,
      });
      if (item.done) finished++;
      else added++;
    }
    if (fresh.length) await supabase.from("tasks").insert(fresh);
    revalidatePath("/", "layout");
    return NextResponse.json({ added, finished, already });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that list." }, { status: 502 });
  }
}
