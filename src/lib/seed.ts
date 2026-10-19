import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * First-run starting point, built from what Max has already said about his life and plans.
 * Everything here is editable in the app — it's a starting point, not a prescription.
 */
const ABOUT_ME = `Engineer turned maker. Studied mechanical engineering at the University of Michigan, worked at Toyota and Boeing, left Boeing to go all in on crypto, then did product management at Dapper Labs. Started my own software company, grew it to a team of four and six figures in year two; it has been flat for a year and now brings in about $3k/month, which doesn't sustain my life.

I spend my time cooking, fermenting, DJing, drawing and painting, and doing pottery. I love to host. I've hosted paid movement events, DJed at festivals, done a cooking event for a well-known chef, learned to scuba dive, and built inventions growing up. I'm a risk taker; when I set my mind to something I can do it.

I don't want another job. I want to find the aligned work that lets me make money sustainably by sharing my gifts. My hardest challenge has been sharing my work and finding the people who connect with it. I mostly know what I'm meant to share — what I need now is discipline and direction.

Instagram: truetomax (personal home base).`;

const PROJECTS = [
  { key: "pottery", title: "Pottery & art", area: "art", makes_money: true, description: "Pottery, drawing and painting. Toward selling work and showing in a gallery." },
  { key: "dj", title: "DJing", area: "music", makes_money: true, description: "Sets, gigs, recorded mixes. Toward booking more paid gigs." },
  { key: "cooking", title: "Cooking & hosting", area: "food", makes_money: true, description: "Dinners, fermentation, private chef work. Toward paid dinners and events." },
  { key: "sharing", title: "Sharing my work", area: "sharing", makes_money: false, description: "Capturing and posting what I make so the right people find it. truetomax is home base." },
];

const GOALS: { project: string; title: string; metric?: string; target?: number }[] = [
  { project: "pottery", title: "Get paid for my pottery and artwork", metric: "pieces sold", target: 1 },
  { project: "pottery", title: "Have my work shown in a gallery", metric: "shows", target: 1 },
  { project: "dj", title: "Land 5 new DJ gigs", metric: "gigs", target: 5 },
  { project: "cooking", title: "Host 2 paid dinners per month", metric: "paid dinners this month", target: 2 },
  { project: "cooking", title: "Get hired as a private chef for a public event", metric: "events", target: 1 },
  { project: "sharing", title: "Post at least once a week", metric: "posts this week", target: 1 },
];

// weekday: 0 = Sunday ... 6 = Saturday
const RHYTHM: { weekday: number[]; title: string; project?: string }[] = [
  { weekday: [0, 1, 2, 3, 4, 5, 6], title: "Morning routine and set intentions" },
  { weekday: [1, 3, 5], title: "Work out" },
  { weekday: [1, 3, 5], title: "Bike to the pottery studio", project: "pottery" },
  { weekday: [2], title: "DJ practice or artwork", project: "dj" },
  { weekday: [2], title: "Hike" },
  { weekday: [4], title: "DJ or artwork at home", project: "dj" },
  { weekday: [2, 4], title: "Cook an amazing dinner — capture it", project: "cooking" },
  { weekday: [6], title: "Farmers market" },
  { weekday: [6], title: "Optional: studio or cooking day" },
  { weekday: [0], title: "Content session: edit and post last week's captures", project: "sharing" },
];

export async function seedIfNeeded(supabase: SupabaseClient) {
  const { data: ctx } = await supabase.from("profile_context").select("seeded").maybeSingle();
  if (ctx?.seeded) return;

  await supabase.from("profile_context").upsert({ about_me: ABOUT_ME, seeded: true });

  const { data: vision } = await supabase
    .from("visions")
    .insert({
      title: "Live from my gifts",
      horizon: "1 year",
      body: "Make a sustainable living from the things I already love doing — art and pottery, music, food and gathering — without going back to a job. Share my work openly and find the people who connect with it.",
    })
    .select("id")
    .single();

  const { data: projects } = await supabase
    .from("projects")
    .insert(PROJECTS.map((p) => ({ title: p.title, area: p.area, makes_money: p.makes_money, description: p.description, vision_id: vision?.id })))
    .select("id, title");

  const idFor = (key?: string) => {
    if (!key) return null;
    const title = PROJECTS.find((p) => p.key === key)?.title;
    return projects?.find((p) => p.title === title)?.id ?? null;
  };

  await supabase.from("goals").insert(
    GOALS.map((g) => ({ project_id: idFor(g.project), title: g.title, metric: g.metric, target: g.target }))
  );

  await supabase.from("rhythm").insert(
    RHYTHM.flatMap((r, i) => r.weekday.map((weekday) => ({ weekday, title: r.title, project_id: idFor(r.project), sort: i })))
  );
}
