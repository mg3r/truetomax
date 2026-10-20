import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askJSON, buildContext } from "@/lib/ai";
import { socialsContext } from "@/lib/socials";

export const maxDuration = 120;

type Idea = { title: string; body: string; first_step: string; money_path?: string };

const PROMPTS = {
  venture: `Surface 3 new, feasible ideas for how Max could earn sustainable income from what he already does and loves. Each must be something he could test within two weeks with what he has now (skills, kitchen, studio, decks, Charlottesville community, truetomax). Prefer ideas that combine his gifts (e.g. food + music + gathering) and that put him in front of paying people. Skip anything already in play (including his projects, in progress or in the backlog) or eliminated.
Return [{"title": short name, "body": 2-3 sentences on what it is and why it fits him, "first_step": one concrete action he can do this week, "money_path": who pays, roughly how much, and how often}]`,
  content: `Max's Instagram is truetomax (a professional account). Use his socials below: build on the kinds of posts that got the most views, saves and shares, follow the latest recommendations, and say which past post you're building on. His challenge is sharing his work and finding the people who connect with it. Suggest 3 specific posts or short series he could make from what he is actually doing this week (look at his rhythm, recent work and journal). Each should show his process or invite people in (to a dinner, a set, the studio) — not just a polished result.
Return [{"title": the post/series idea, "body": what to capture and how to frame it, 2-3 sentences, "first_step": exactly what to film or photograph next time he's doing it, "money_path": how this could lead to a booking, sale or seat, or omit if it's purely audience-building}]`,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { kind } = await req.json();
  const k = kind === "content" ? "content" : "venture";
  try {
    const context = await buildContext(supabase, { query: k === "content" ? "sharing posting instagram audience" : "income money paid offer clients" });
    // Sharing ideas read your socials in full: every synced post, what's landing, and the latest recommendations.
    const socials = k === "content" ? await socialsContext(supabase).catch(() => "") : "";
    const ideas = await askJSON<Idea[]>(PROMPTS[k], socials ? `${context}\n\n# His socials in full\n${socials}` : context, 4000);
    const picks = ideas.slice(0, 3);
    if (k === "venture") {
      // Work-and-income ideas become Backlog projects: start one when it's alive, or delete it (that's the elimination).
      for (const i of picks) {
        const { data: project } = await supabase
          .from("projects")
          .insert({
            title: i.title,
            description: [i.body, i.money_path && `Money path: ${i.money_path}`].filter(Boolean).join("\n\n"),
            status: "paused",
            makes_money: !!i.money_path,
          })
          .select("id")
          .single();
        if (project && i.first_step) await supabase.from("tasks").insert({ title: i.first_step, project_id: project.id, day: "9999-12-31" });
        await supabase.from("ideas").insert({ kind: k, title: i.title, body: i.body, first_step: i.first_step, money_path: i.money_path ?? null, status: "planned", project_id: project?.id ?? null });
      }
    } else {
      await supabase.from("ideas").insert(picks.map((i) => ({ kind: k, title: i.title, body: i.body, first_step: i.first_step, money_path: i.money_path ?? null })));
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
