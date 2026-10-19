"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { remember, forget, journalText } from "@/lib/memory";

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
  const { data: before } = await supabase.from("tasks").select("title, status, category, project_id, day, reason, source").eq("id", id).single();
  if (!before) return;
  const now = new Date().toISOString();
  await supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? now : null,
      // Accepting a partner suggestion is a signal the partner learns from.
      ...(before.status === "suggested" && status !== "skipped" ? { accepted_at: now } : {}),
    })
    .eq("id", id);

  // Finishing a share or ask task counts as a move.
  if (before.category === "share" || before.category === "ask") {
    if (status === "done") {
      const { count } = await supabase.from("moves").select("id", { count: "exact", head: true }).eq("task_id", id);
      if (!count) await supabase.from("moves").insert({ kind: before.category === "share" ? "shared" : "asked", note: before.title, project_id: before.project_id, task_id: id, day: today() });
    } else {
      await supabase.from("moves").delete().eq("task_id", id);
    }
  }

  if (status === "done" || status === "skipped") {
    const text = `${status === "done" ? "Did" : "Skipped"}${before.source === "partner" ? " (partner suggestion)" : ""}: ${before.title}${before.reason ? ` — suggested because: ${before.reason}` : ""}`;
    after(() => remember(supabase, "task", id, text, before.day));
  } else {
    after(() => forget(supabase, "task", id));
  }
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
  const { data: entry } = id
    ? await supabase.from("journal_entries").update({ body, updated_at: new Date().toISOString() }).eq("id", id).select("id, day, prompt, body").single()
    : await supabase.from("journal_entries").insert({ body, prompt: str(fd, "prompt"), day: str(fd, "day") ?? today() }).select("id, day, prompt, body").single();
  if (entry) after(() => remember(supabase, "journal", entry.id, journalText(entry), entry.day));
  refresh();
}

export async function deleteJournal(id: string) {
  const supabase = await db();
  await supabase.from("journal_entries").delete().eq("id", id);
  await forget(supabase, "journal", id);
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
  const { data: v } = id
    ? await supabase.from("visions").update(row).eq("id", id).select("id").single()
    : await supabase.from("visions").insert(row).select("id").single();
  if (v) after(() => remember(supabase, "vision", v.id, `Vision (${row.horizon}): ${row.title}. ${row.body}`));
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
  const practiceIds = fd.getAll("practice_ids").filter((v): v is string => typeof v === "string" && !!v);
  const linkPractices = async (projectId: string) => {
    if (!fd.has("practices_present")) return; // form didn't include the practice picker
    await supabase.from("project_practices").delete().eq("project_id", projectId);
    if (practiceIds.length) await supabase.from("project_practices").insert(practiceIds.map((practice_id) => ({ project_id: projectId, practice_id })));
  };
  if (id) {
    await supabase.from("projects").update(row).eq("id", id);
    await linkPractices(id);
    refresh();
  } else {
    const { data } = await supabase.from("projects").insert(row).select("id").single();
    if (data) await linkPractices(data.id);
    refresh();
    if (data) redirect(`/projects/${data.id}`);
  }
}

export async function setProjectStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status) return;
  const supabase = await db();
  const note = str(fd, "note");
  const { data: p } = await supabase.from("projects").update({ status, status_note: note, updated_at: new Date().toISOString() }).eq("id", id).select("title").single();
  if (p && status !== "active") after(() => remember(supabase, "project", id, `Project "${p.title}" ${status}${note ? `: ${note}` : ""}`));
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
  const weekdays = fd.getAll("weekday").map((w) => Number(w)).filter((w) => Number.isInteger(w) && w >= 0 && w <= 6);
  if (!title || !weekdays.length) return;
  const supabase = await db();
  const at_time = str(fd, "at_time");
  await supabase.from("rhythm").insert(
    weekdays.map((weekday) => ({ title, weekday, at_time, practice_id: str(fd, "practice_id"), project_id: str(fd, "project_id"), sort: 100 }))
  );
  refresh();
}

export async function updateRhythm(fd: FormData) {
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!id || !title) return;
  const supabase = await db();
  await supabase.from("rhythm").update({ title, at_time: str(fd, "at_time"), practice_id: str(fd, "practice_id") }).eq("id", id);
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
  const note = str(fd, "note");
  const { data: idea } = await supabase.from("ideas").update({ status, status_note: note }).eq("id", id).select("title").single();
  if (idea && status === "eliminated") after(() => remember(supabase, "idea", id, `Eliminated idea "${idea.title}"${note ? `: ${note}` : ""}`));
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

/* Moves: sharing your work or asking to be paid */
export async function logMove(fd: FormData) {
  const kind = str(fd, "kind");
  if (!kind || !["shared", "asked", "booked", "sold"].includes(kind)) return;
  const supabase = await db();
  const note = str(fd, "note");
  const amount = num(fd, "amount");
  const { data: m } = await supabase.from("moves").insert({ kind, note, amount, project_id: str(fd, "project_id"), day: today() }).select("id").single();
  if (m) after(() => remember(supabase, "move", m.id, `Move — ${kind}${note ? `: ${note}` : ""}${amount ? ` ($${amount})` : ""}`));
  refresh();
}

export async function deleteMove(id: string) {
  const supabase = await db();
  await supabase.from("moves").delete().eq("id", id);
  await forget(supabase, "move", id);
  refresh();
}

/* What the partner has learned */
export async function setInsightStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !status || !["confirmed", "rejected", "retired", "proposed"].includes(status)) return;
  const supabase = await db();
  await supabase
    .from("insights")
    .update({ status, your_note: str(fd, "note"), updated_at: new Date().toISOString(), ...(status === "confirmed" ? { confidence: 1 } : {}) })
    .eq("id", id);
  refresh();
}

export async function addInsight(fd: FormData) {
  const statement = str(fd, "statement");
  if (!statement) return;
  const supabase = await db();
  await supabase.from("insights").insert({ statement, status: "confirmed", confidence: 1, kind: "preference", evidence: "Max said so" });
  refresh();
}

export async function answerRhythmProposal(id: string, accept: boolean) {
  const supabase = await db();
  const { data: p } = await supabase.from("rhythm_proposals").select("*").eq("id", id).eq("status", "proposed").single();
  if (!p) return;
  if (accept) {
    if (p.action === "add") await supabase.from("rhythm").insert({ weekday: p.weekday, title: p.title, sort: 50 });
    if (p.action === "remove" && p.rhythm_id) await supabase.from("rhythm").delete().eq("id", p.rhythm_id);
    if (p.action === "move" && p.rhythm_id) await supabase.from("rhythm").update({ weekday: p.to_weekday }).eq("id", p.rhythm_id);
  }
  await supabase.from("rhythm_proposals").update({ status: accept ? "accepted" : "declined" }).eq("id", id);
  after(() => remember(supabase, "rhythm", id, `${accept ? "Accepted" : "Declined"} rhythm change: ${p.reason}`));
  refresh();
}

export async function markReviewSeen(id: string) {
  const supabase = await db();
  await supabase.from("reviews").update({ seen: true }).eq("id", id);
  refresh();
}

/* Your book, page by page */
export async function saveBookPages(book: string, pages: { page: number; text: string }[], replace: boolean): Promise<{ error?: string }> {
  const supabase = await db();
  // Errors are returned, not thrown: thrown messages are hidden from the browser in production.
  if (replace) {
    const { error } = await supabase.from("book_pages").delete().not("id", "is", null);
    if (error) return { error: "The book table isn't set up yet. Run 0003_book.sql in the Supabase SQL editor, then try again." };
  }
  const rows = pages
    .filter((p) => Number.isInteger(p.page) && typeof p.text === "string" && p.text.trim())
    .map((p) => ({ book: book.slice(0, 200), page: p.page, text: p.text.slice(0, 20000) }));
  if (!rows.length) return {};
  const { error } = await supabase.from("book_pages").upsert(rows, { onConflict: "user_id,book,page" });
  return error ? { error: error.message } : {};
}

/* Project board: move a task between Later, Up next, Today and Done */
export type Lane = "later" | "next" | "today" | "done";

export async function moveTask(id: string, lane: Lane) {
  const supabase = await db();
  const { data: t } = await supabase.from("tasks").select("status, day").eq("id", id).single();
  if (!t) return;
  if (lane === "done") {
    if (t.status !== "done") await setTaskStatus(id, "done");
    return;
  }
  if (t.status === "done") await setTaskStatus(id, "todo");
  const now = today();
  const day = lane === "later" ? null : lane === "today" ? now : t.day && t.day > now ? t.day : addDays(now, 1);
  await supabase.from("tasks").update({ day, status: "todo" }).eq("id", id);
  refresh();
}

export async function addBoardTask(projectId: string, lane: Exclude<Lane, "done">, title: string) {
  if (!title.trim()) return;
  const supabase = await db();
  const now = today();
  await supabase.from("tasks").insert({
    title: title.trim(),
    project_id: projectId,
    day: lane === "later" ? null : lane === "today" ? now : addDays(now, 1),
  });
  refresh();
}

/* Practices: the aligned actions that feed your projects */
export async function addPractice(fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  const supabase = await db();
  await supabase.from("practices").insert({ name, description: str(fd, "description") ?? "" });
  refresh();
}

export async function renamePractice(fd: FormData) {
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!id || !name) return;
  const supabase = await db();
  await supabase.from("practices").update({ name, description: str(fd, "description") ?? "" }).eq("id", id);
  refresh();
}

export async function deletePractice(id: string) {
  const supabase = await db();
  await supabase.from("practices").delete().eq("id", id);
  refresh();
}

export async function setProjectPractices(projectId: string, practiceIds: string[]) {
  const supabase = await db();
  await supabase.from("project_practices").delete().eq("project_id", projectId);
  if (practiceIds.length) await supabase.from("project_practices").insert(practiceIds.map((practice_id) => ({ project_id: projectId, practice_id })));
  refresh();
}

/**
 * Start the plan fresh: removes every project with its goals and tasks.
 * Keeps visions, practices, your routine, journal, moves and what the partner has learned.
 */
export async function resetPlan(fd: FormData) {
  if (fd.get("confirm") !== "clear") return;
  const supabase = await db();
  await supabase.from("tasks").delete().not("project_id", "is", null);
  await supabase.from("tasks").delete().eq("status", "suggested");
  await supabase.from("projects").delete().not("id", "is", null);
  refresh();
  redirect("/plan");
}

/** Bring routine changes into today without waiting for tomorrow. Only adds what isn't on today yet. */
export async function applyRoutineToday() {
  const supabase = await db();
  const day = today();
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const [{ data: rhythm }, { data: existing }] = await Promise.all([
    supabase.from("rhythm").select("title, project_id, practice_id, at_time").eq("weekday", weekday).order("sort"),
    supabase.from("tasks").select("title").eq("day", day).eq("source", "rhythm"),
  ]);
  const have = new Set((existing ?? []).map((t) => t.title));
  const add = (rhythm ?? []).filter((r) => !have.has(r.title));
  if (add.length) await supabase.from("tasks").insert(add.map((r) => ({ ...r, day, source: "rhythm" })));
  refresh();
}
