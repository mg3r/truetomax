import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askJSON, buildContext } from "@/lib/ai";
import { socialsContext, type SocialRead } from "@/lib/socials";
import { syncInstagram, lookAtPosts } from "@/lib/instagram";

export const maxDuration = 300;

/** The partner reads your posts and their numbers, and says what's working and what to do next. */
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  try {
    await syncInstagram(supabase, { force: true }).catch(() => {});
    // Look at posts it hasn't seen yet, so the read is about what's actually in them.
    await lookAtPosts(supabase, 12).catch(() => 0);
    const socials = await socialsContext(supabase);
    if (!socials) return NextResponse.json({ error: "Connect Instagram first (Profile → Settings)." }, { status: 400 });
    const context = await buildContext(supabase, { query: "sharing posting instagram audience what lands" });
    const read = await askJSON<SocialRead>(
      `${socials}

Read Max's Instagram like a sharp, honest friend who knows content. Ground every point in the numbers above and in what's actually in each post (the [what's in it] and [opens with] notes). Use the deeper numbers when they're there: skip rate and average watch time against length for reels (is the opening holding people?), share and save rates (out of reach), follows and profile visits a post drove, and how much of his reach comes from non-followers: name the posts, and connect what's in them (subject, whether he's in frame, process vs finished, style) to how they did. His aim: share his real work (cooking, pottery, music, hosting) and reach the people who connect with it, and turn some of them into paying guests and buyers. With few posts, say so and keep it to what the record supports.
Return {"summary": 2-3 sentences on where his account is and what the numbers say, "working": up to 4 short points on what's landing and why, "not_working": up to 3 short points, "recommendations": 3-5 items {"title": a specific change or experiment, "why": the evidence behind it, "try": exactly what to do this week}}`,
      context
    );
    const { error } = await supabase.from("social_insights").insert({ platform: "instagram", body: read });
    if (error) return NextResponse.json({ error: "Run 0012_socials.sql in Supabase first." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The partner is unavailable." }, { status: 502 });
  }
}
