import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askJSON, buildContext } from "@/lib/ai";
import { socialsContext } from "@/lib/socials";

export const maxDuration = 120;

type Idea = { title: string; body: string; first_step?: string; money_path?: string; project?: string };

const PROMPTS = {
  venture: `Surface 3 new, feasible ideas for how Max could earn sustainable income from what he already does and loves. Each must be something he could test within two weeks with what he has now (skills, kitchen, studio, decks, Charlottesville community, truetomax). Prefer ideas that combine his gifts (e.g. food + music + gathering) and that put him in front of paying people. Skip anything already in play (including his projects, in progress or in the backlog) or eliminated.
Return [{"title": short name, "body": 2-3 sentences on what it is and why it fits him, "first_step": one concrete action he can do this week, "money_path": who pays, roughly how much, and how often}]`,
  content: `Max's Instagram is truetomax (a professional account). Use his socials below: build on the kinds of posts that got the most views, saves and shares, follow the latest recommendations, and say which past post you're building on. His challenge is sharing his work and finding the people who connect with it. Suggest 3 specific posts or short series he could make from what he is actually doing this week (look at his rhythm, recent work and journal). Each should show his process or invite people in (to a dinner, a set, the studio) — not just a polished result.
Return [{"title": the post/series idea, "body": what to capture and how to frame it, 2-3 sentences, "first_step": exactly what to film or photograph next time he's doing it, "money_path": how this could lead to a booking, sale or seat, or omit if it's purely audience-building}]`,
  action: `Suggest 3 new actions Max could do in the next few days, for when he wants more than today's suggestions. Each is one sitting, concrete, and names exactly what "done" looks like. Favor finishing, sharing his work, and asking someone to book, buy or pay; build on his in-progress projects, his practices and what he's been doing lately. Don't repeat anything already in his open actions, today's suggestions, or what he's eliminated. Ground every one in what's live in the app (projects, rhythm, actions, journal, moves); his docs are background only.
Return [{"title": short imperative with its definition of done, "body": one or two sentences on why this, now, "project": the exact title of the in-progress project it serves, or omit}]`,
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { kind } = await req.json();
  const k = kind === "content" ? "content" : kind === "action" ? "action" : "venture";
  try {
    const context = await buildContext(supabase, { query: k === "content" ? "sharing posting instagram audience" : k === "action" ? "next actions finish share ask projects practices" : "income money paid offer clients" });
    // Sharing ideas read your socials in full: every synced post, what's landing, and the latest recommendations.
    const socials = k === "content" ? await socialsContext(supabase).catch(() => "") : "";
    const ideas = await askJSON<Idea[]>(PROMPTS[k], socials ? `${context}\n\n# His socials in full\n${socials}` : context, 4000);
    const picks = ideas.slice(0, 3);
    // An action idea remembers the project it serves, so adding it puts it there.
    const { data: projects } = k === "action" ? await supabase.from("projects").select("id, title").eq("status", "active") : { data: [] };
    const projectId = (name?: string) => (name ? (projects ?? []).find((p) => p.title.toLowerCase() === name.toLowerCase())?.id ?? null : null);
    const { error } = await supabase
      .from("ideas")
      .insert(picks.map((i) => ({ kind: k, title: i.title, body: i.body, first_step: i.first_step ?? null, money_path: i.money_path ?? null, ...(k === "action" ? { project_id: projectId(i.project) } : {}) })));
    if (error && k === "action") return NextResponse.json({ error: "Run 0024_action_ideas.sql in Supabase first." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
