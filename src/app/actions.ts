"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === null || isNaN(Number(v)) ? null : Number(v);
};
const refresh = () => revalidatePath("/", "layout");

async function db() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return supabase;
}

/* Tasks */
export async function addTask(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const supabase = await db();
  await supabase.from("tasks").insert({
    title,
    day: fd.has("backlog") ? null : str(fd, "day") ?? today(),
    project_id: str(fd, "project_id"),
    goal_id: str(fd, "goal_id"),
  });
  refresh();
}

export async function setTaskStatus(id: string, status: "todo" | "done" | "skipped" | "suggested") {
  const supabase = await db();
  await supabase
    .from("tasks")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  refresh();
}

export async function scheduleTask(id: string, day: string | null) {
  const supabase = await db();
  await supabase.from("tasks").update({ day, status: "todo" }).eq("id", id);
  refresh();
}

export async function deleteTask(id: string) {
  const supabase = await db();
  await supabase.from("tasks").delete().eq("id", id);
  refresh();
}

/* Journal */
export async function saveJournal(fd: FormData) {
  const body = str(fd, "body");
  if (!body) return;
  const supabase = await db();
  const id = str(fd, "id");
  if (id) await supabase.from("journal_entries").update({ body, updated_at: new Date().toISOString() }).eq("id", id);
  else await supabase.from("journal_entries").insert({ body, prompt: str(fd, "prompt"), day: str(fd, "day") ?? today() });
  refresh();
}

export async function deleteJournal(id: string) {
  const supabase = await db();
  await supabase.from("journal_entries").delete().eq("id", id);
  refresh();
}

/* Highlights */
export async function addHighlight(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  const supabase = await db();
  await supabase.from("highlights").insert({ text, source: str(fd, "source") ?? "The Creative Act", location: str(fd, "location"), note: str(fd, "note") });
  refresh();
}

export async function deleteHighlight(id: string) {
  const supabase = await db();
  await supabase.from("highlights").delete().eq("id", id);
  refresh();
}

/* Visions */
export async function saveVision(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const supabase = await db();
  const row = { title, body: str(fd, "body") ?? "", horizon: str(fd, "horizon") ?? "1 year", updated_at: new Date().toISOString() };
  const id = str(fd, "id");
  if (id) await supabase.from("visions").update(row).eq("id", id);
  else await supabase.from("visions").insert(row);
  refresh();
}

export async function setVisionStatus(id: string, status: "active" | "realized" | "released") {
  const supabase = await db();
  await supabase.from("visions").update({ status }).eq("id", id);
  refresh();
}

/* Projects */
export async function saveProject(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const supabase = await db();
  const row = {
    title,
    description: str(fd, "description") ?? "",
    area: str(fd, "area") ?? "other",
    vision_id: str(fd, "vision_id"),
    makes_money: fd.get("makes_money") === "on",
    updated_at: new Date().toISOString(),
  };
  const id = str(fd, "id");
  if (id) {
    await supabase.from("projects").update(row).eq("id", id);
    refresh();
  } else {
    const { data } = await supabase.from("projects").insert(row).select("id").single();
    refresh();
    if (data) redirect(`/projects/${data.id}`);
  }
}

export async function setProjectStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status) return;
  const supabase = await db();
  await supabase.from("projects").update({ status, status_note: str(fd, "note"), updated_at: new Date().toISOString() }).eq("id", id);
  refresh();
}

/* Goals */
export async function saveGoal(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const supabase = await db();
  const row = { title, project_id: str(fd, "project_id"), metric: str(fd, "metric"), target: num(fd, "target"), due_date: str(fd, "due_date") };
  const id = str(fd, "id");
  if (id) await supabase.from("goals").update(row).eq("id", id);
  else await supabase.from("goals").insert(row);
  refresh();
}

export async function bumpGoal(id: string, delta: number) {
  const supabase = await db();
  const { data } = await supabase.from("goals").select("current, target").eq("id", id).single();
  if (!data) return;
  const current = Math.max(0, Number(data.current) + delta);
  await supabase
    .from("goals")
    .update({ current, status: data.target != null && current >= Number(data.target) ? "achieved" : "active" })
    .eq("id", id);
  refresh();
}

export async function setGoalStatus(id: string, status: "active" | "achieved" | "dropped") {
  const supabase = await db();
  await supabase.from("goals").update({ status }).eq("id", id);
  refresh();
}

/* Weekly rhythm */
export async function addRhythm(fd: FormData) {
  const title = str(fd, "title");
  const weekday = num(fd, "weekday");
  if (!title || weekday === null) return;
  const supabase = await db();
  await supabase.from("rhythm").insert({ title, weekday, project_id: str(fd, "project_id"), sort: 100 });
  refresh();
}

export async function deleteRhythm(id: string) {
  const supabase = await db();
  await supabase.from("rhythm").delete().eq("id", id);
  refresh();
}

/* Ideas */
export async function addIdea(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const supabase = await db();
  await supabase.from("ideas").insert({ title, body: str(fd, "body") ?? "", kind: str(fd, "kind") ?? "venture", source: "me" });
  refresh();
}

export async function setIdeaStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status) return;
  const supabase = await db();
  await supabase.from("ideas").update({ status, status_note: str(fd, "note") }).eq("id", id);
  refresh();
}

/** Commit to an idea: it becomes a project, and its first step becomes today's task. */
export async function ideaToProject(id: string) {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").select("*").eq("id", id).single();
  if (!idea) return;
  const { data: project } = await supabase
    .from("projects")
    .insert({ title: idea.title, description: [idea.body, idea.money_path && `Money path: ${idea.money_path}`].filter(Boolean).join("\n\n"), makes_money: !!idea.money_path })
    .select("id")
    .single();
  if (project && idea.first_step) await supabase.from("tasks").insert({ title: idea.first_step, project_id: project.id, day: today() });
  await supabase.from("ideas").update({ status: "planned", project_id: project?.id }).eq("id", id);
  refresh();
  if (project) redirect(`/projects/${project.id}`);
}

export async function contentIdeaToTask(id: string) {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").select("title, first_step").eq("id", id).single();
  if (!idea) return;
  const { data: sharing } = await supabase.from("projects").select("id").eq("area", "sharing").limit(1).maybeSingle();
  await supabase.from("tasks").insert({ title: idea.first_step ? `${idea.title}: ${idea.first_step}` : idea.title, project_id: sharing?.id ?? null, day: today() });
  await supabase.from("ideas").update({ status: "planned" }).eq("id", id);
  refresh();
}

/* Profile */
export async function saveAboutMe(fd: FormData) {
  const supabase = await db();
  await supabase.from("profile_context").update({ about_me: str(fd, "about_me") ?? "" }).not("user_id", "is", null);
  refresh();
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
