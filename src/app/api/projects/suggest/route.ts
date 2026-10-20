import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { askJSON, buildContext } from "@/lib/ai";
import { loadPractices } from "@/lib/routine";

export const maxDuration = 120;

type Step = { title: string; done?: string; reason: string; category?: string; size?: string; practice?: string };
const CATEGORIES = ["make", "practice", "share", "ask", "learn", "admin", "body", "rest"];

/** Your partner proposes the next few steps for one project, from everything it knows. You keep the ones you want. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { projectId } = await req.json();

  const { data: p } = await supabase.from("projects").select("id, title, description, status").eq("id", projectId).maybeSingle();
  if (!p) return NextResponse.json({ error: "That project isn't there." }, { status: 404 });

  const [goals, tasks, practiceRows] = await Promise.all([
    supabase.from("goals").select("title, status").eq("project_id", p.id).neq("status", "dropped"),
    supabase.from("tasks").select("title, status, day").eq("project_id", p.id).in("status", ["todo", "done", "skipped", "suggested"]).order("created_at", { ascending: false }).limit(60),
    loadPractices(supabase),
  ]);
  const practices = practiceRows;
  const t = tasks.data ?? [];
  const list = (status: string) => t.filter((x) => x.status === status).map((x) => `- ${x.title}`).join("\n") || "(none)";

  try {
    const context = await buildContext(supabase, { journalCount: 10, query: `${p.title}. ${p.description ?? ""}` });
    const steps = await askJSON<Step[]>(
      `## The project: ${p.title}
${p.description || "(no description yet)"}
Goals:\n${(goals.data ?? []).map((g) => `- ${g.title}${g.status === "achieved" ? " (done)" : ""}`).join("\n") || "(none yet)"}
Open tasks:\n${list("todo")}
Done:\n${list("done")}
Skipped or declined before (don't re-suggest):\n${[list("skipped"), list("suggested")].join("\n")}

Propose the next 3 to 5 concrete steps for this project, in the order he should do them. Use everything you know: this project's goals and tasks, his vision, his own docs and uploads, his journal, his routine and crafts, what you've learned about how he works, and his socials. Each step should be doable in a sitting or two, with a clear finish line, and move the project toward something real: a finished piece, a shared post, an offer sent, a paying person. Don't repeat open tasks.
Return [{"title": a short imperative, under 10 words, "done": what finished looks like, one short line, "reason": one sentence on why this step now, grounded in what you know, "category": make/practice/share/ask/learn/admin/body/rest, "size": small/medium/large, "practice": the exact name of the practice it's a session of, from this list, or omit [${practices.map((x) => x.name).join(", ")}]}]`,
      context
    );
    // Clear the previous round of unanswered suggestions for this project, then add the new ones.
    await supabase.from("tasks").delete().eq("project_id", p.id).eq("status", "suggested").is("day", null);
    const rows = steps.slice(0, 5).map((s) => ({
      title: s.title,
      reason: [s.reason, s.done && `Done when: ${s.done}`].filter(Boolean).join("\n\n"),
      category: CATEGORIES.includes(s.category ?? "") ? s.category : null,
      size: ["small", "medium", "large"].includes(s.size ?? "") ? s.size : null,
      project_id: p.id,
      ...(practices.find((x) => x.name.toLowerCase() === (s.practice ?? "").trim().toLowerCase())
        ? { routine_id: practices.find((x) => x.name.toLowerCase() === (s.practice ?? "").trim().toLowerCase())!.id }
        : {}),
      status: "suggested",
      source: "partner",
      day: null,
    }));
    if (rows.length) await supabase.from("tasks").insert(rows);
    revalidatePath(`/projects/${p.id}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
