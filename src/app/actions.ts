"use server";

import { projectsOf, practicesOf } from "@/lib/links";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { today, addDays } from "@/lib/dates";
import { remember, forget, journalText, rememberDoc } from "@/lib/memory";
import { movesFromAction, movesFromJournal } from "@/lib/moves";
import { visionText } from "@/lib/vision";
import { readGoogleDoc } from "@/lib/google";
import { syncDriveFolder } from "@/lib/drive";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === null || isNaN(Number(v)) ? null : Number(v);
};
const refresh = () => revalidatePath("/", "layout");
/** Up next with no day yet: far in the future, so it never lands on Today or Schedule by itself. */
const UNDATED = "9999-12-31";
const partOfDay = (v: string | null) => (v && ["morning", "afternoon", "evening"].includes(v) ? v : null);

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
  const { data: before } = await supabase.from("tasks").select("*").eq("id", id).single();
  if (!before) return;
  if (before.status === "suggested" && status === "todo" && before.origin_task_id) {
    // The partner offered one of your Up next tasks: that task moves to today, and the suggestion goes.
    await supabase.from("tasks").update({ day: before.day, status: "todo", reason: before.reason, accepted_at: new Date().toISOString(), source: "partner" }).eq("id", before.origin_task_id);
    await supabase.from("days").update({ focus_task_id: before.origin_task_id }).eq("focus_task_id", id).then(() => null, () => null);
    await supabase.from("tasks").delete().eq("id", id);
    refresh();
    return;
  }
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

  // An action that's a session of a practice ticks that practice off in your Rhythm when it's done.
  const practiceIds = practicesOf(before);
  if (practiceIds.length && (status === "done" || before.status === "done")) {
    const day = before.day && before.day !== UNDATED ? before.day : today();
    if (status === "done") await supabase.from("routine_checks").upsert(practiceIds.map((routine_id) => ({ routine_id, day })), { onConflict: "routine_id,day" });
    else await supabase.from("routine_checks").delete().in("routine_id", practiceIds).eq("day", day);
  }

  // Finishing an action that puts your work in front of people (or asks to be paid) counts as a move; undoing it takes it back.
  if (status === "done") after(() => movesFromAction(supabase, { id, title: before.title, project_id: before.project_id, day: before.day }, true));
  else if (before.status === "done") {
    await supabase.from("moves").delete().eq("task_id", id);
    after(() => movesFromAction(supabase, { id, title: before.title }, false));
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
  await forget(supabase, "task", id);
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
  if (entry) after(() => movesFromJournal(supabase, { id: entry.id, body: entry.body }));
  refresh();
}

export async function deleteJournal(id: string) {
  const supabase = await db();
  await supabase.from("journal_entries").delete().eq("id", id);
  await supabase.from("moves").delete().eq("source", "journal").eq("source_id", id);
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
  const part_of_day = partOfDay(str(fd, "part_of_day"));
  await supabase.from("rhythm").insert(weekdays.map((weekday) => ({ title, weekday, at_time, part_of_day, sort: 100 })));
  refresh();
}

export async function updateRhythm(fd: FormData) {
  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!id || !title) return;
  const supabase = await db();
  await supabase.from("rhythm").update({ title, at_time: str(fd, "at_time"), part_of_day: partOfDay(str(fd, "part_of_day")) }).eq("id", id);
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

/** Turn a project idea into a project: start it now (In progress) or keep it for later (Backlog). Its first step waits in Up next. */
export async function ideaToProject(id: string, status: "review" | "active" | "paused" = "review") {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").select("*").eq("id", id).single();
  if (!idea) return;
  const { data: project } = await supabase
    .from("projects")
    .insert({ title: idea.title, description: [idea.body, idea.money_path && `Money path: ${idea.money_path}`].filter(Boolean).join("\n\n"), makes_money: !!idea.money_path, status })
    .select("id")
    .single();
  if (project && idea.first_step) await supabase.from("tasks").insert({ title: idea.first_step, project_id: project.id, day: UNDATED, reason: idea.body ?? null });
  await supabase.from("ideas").update({ status: "planned", project_id: project?.id }).eq("id", id);
  refresh();
}

export async function contentIdeaToTask(id: string) {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").select("title, body, first_step, money_path").eq("id", id).single();
  if (!idea) return;
  // A post idea you keep becomes an Up next action, ready for when it fits. Everything the idea said comes with it, as its notes.
  const notes = [idea.first_step && `Next time: ${idea.first_step}`, idea.body, idea.money_path && `Money path: ${idea.money_path}`].filter(Boolean).join("\n\n");
  await supabase.from("tasks").insert({ title: idea.title, reason: notes || null, day: UNDATED, source: "partner" });
  await supabase.from("ideas").update({ status: "planned" }).eq("id", id);
  refresh();
}

/** An action idea you keep goes to Up next (in its project, if it has one), with its why kept as notes. */
export async function actionIdeaToTask(id: string) {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").select("title, body, project_id").eq("id", id).single();
  if (!idea) return;
  await supabase.from("tasks").insert({ title: idea.title, reason: idea.body ?? null, project_id: idea.project_id ?? null, day: UNDATED, source: "partner" });
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
  const { data: m } = await supabase.from("moves").select("kind, note").eq("id", id).maybeSingle();
  await supabase.from("moves").delete().eq("id", id);
  await forget(supabase, "move", id);
  // Removing one teaches the partner what doesn't count for you.
  if (m?.note) after(() => remember(supabase, "move_fix", id, `Not a move (${m.kind}): "${m.note}"`));
  refresh();
}

/** Add a move the app missed (something done outside it), or money in. Teaches the partner what counts. */
export async function addMove(kind: string, note: string, amount: number | null) {
  if (!["shared", "asked", "booked", "sold"].includes(kind) || !note.trim()) return;
  const supabase = await db();
  const row = { kind, note: note.trim(), amount: amount && amount > 0 ? amount : null, day: today() };
  const first = await supabase.from("moves").insert({ ...row, source: "me" }).select("id").single();
  const m = first.error ? (await supabase.from("moves").insert(row).select("id").single()).data : first.data;
  if (m) {
    after(() => remember(supabase, "move", m!.id, `Move — ${kind}: ${note.trim()}${row.amount ? ` ($${row.amount})` : ""}`));
    after(() => remember(supabase, "move_fix", m!.id, `Counts as a move (${kind}): "${note.trim()}"`));
  }
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
export type Lane = "later" | "next" | "tomorrow" | "today" | "done";

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
  // Up next has no day: it waits in your list (this week), and your partner offers it when it fits. Tomorrow is tomorrow's date.
  const day = lane === "later" ? null : lane === "today" ? now : lane === "tomorrow" ? addDays(now, 1) : UNDATED;
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
    day: lane === "later" ? null : lane === "today" ? now : UNDATED,
  });
  refresh();
}

export async function resetPlan(fd: FormData) {
  if (fd.get("confirm") !== "clear") return;
  const supabase = await db();
  const { data: planTasks } = await supabase.from("tasks").select("id").not("project_id", "is", null);
  if (planTasks?.length) await supabase.from("memory").delete().eq("source_type", "task").in("source_id", planTasks.map((t) => t.id));
  await supabase.from("tasks").delete().not("project_id", "is", null);
  await supabase.from("tasks").delete().eq("status", "suggested");
  await supabase.from("projects").delete().not("id", "is", null);
  await supabase.from("visions").delete().not("id", "is", null);
  await supabase.from("memory").delete().in("source_type", ["vision", "project"]);
  refresh();
  redirect("/vision");
}

/** Bring routine changes into today without waiting for tomorrow. Only adds what isn't on today yet. */
export async function applyRoutineToday() {
  const supabase = await db();
  const day = today();
  const weekday = new Date(day + "T12:00:00Z").getUTCDay();
  const [{ data: rhythm }, { data: existing }] = await Promise.all([
    supabase.from("rhythm").select("*").eq("weekday", weekday).order("sort"),
    supabase.from("tasks").select("title").eq("day", day).eq("source", "rhythm"),
  ]);
  const have = new Set((existing ?? []).map((t) => t.title));
  const add = (rhythm ?? []).filter((r) => !have.has(r.title));
  if (add.length)
    await supabase.from("tasks").insert(
      add.map((r) => ({ title: r.title, project_id: r.project_id, at_time: r.at_time, part_of_day: r.part_of_day, ...(r.routine_id ? { routine_id: r.routine_id } : {}), day, source: "rhythm" }))
    );
  refresh();
}


export async function setGoalCurrent(id: string, current: number) {
  if (!Number.isFinite(current) || current < 0) return;
  const supabase = await db();
  const { data } = await supabase.from("goals").select("target").eq("id", id).single();
  await supabase
    .from("goals")
    .update({ current, status: data?.target != null && current >= Number(data.target) ? "achieved" : "active" })
    .eq("id", id);
  refresh();
}

/* Visions, edited in place */
export async function updateVision(id: string, fields: { title?: string; body?: string }) {
  const supabase = await db();
  const row: Record<string, string> = { updated_at: new Date().toISOString() };
  if (typeof fields.title === "string" && fields.title.trim()) row.title = fields.title.trim();
  if (typeof fields.body === "string") row.body = fields.body;
  await supabase.from("visions").update(row).eq("id", id);
  if (row.body !== undefined || row.title) {
    const { data: v } = await supabase.from("visions").select("title, body, horizon").eq("id", id).single();
    if (v) after(() => remember(supabase, "vision", id, `Vision: ${v.title}. ${visionText(v.body ?? "")}`));
  }
  revalidatePath("/vision");
}

export async function createVision(title: string): Promise<{ id: string } | null> {
  const supabase = await db();
  // New visions go to the top of the doc.
  const { data: first } = await supabase.from("visions").select("sort").order("sort").limit(1).maybeSingle();
  const { data } = await supabase
    .from("visions")
    .insert({ title: title.trim() || "Untitled vision", body: "", sort: (first?.sort ?? 0) - 1 })
    .select("id")
    .single();
  revalidatePath("/vision");
  return data;
}

export async function reorderVisions(ids: string[]) {
  const supabase = await db();
  await Promise.all(ids.map((id, i) => supabase.from("visions").update({ sort: i }).eq("id", id)));
  revalidatePath("/vision");
}

export async function deleteVision(id: string) {
  const supabase = await db();
  await supabase.from("visions").delete().eq("id", id);
  await forget(supabase, "vision", id);
  refresh();
}

/** Add a task to a project and say where it goes: today, up next, later, or already done. */
export async function addProjectTask(projectId: string | null, title: string, lane: Lane) {
  if (!title.trim()) return;
  const supabase = await db();
  const now = today();
  const { data } = await supabase
    .from("tasks")
    .insert({
      title: title.trim(),
      project_id: projectId,
      day: lane === "later" ? null : lane === "next" ? UNDATED : lane === "tomorrow" ? addDays(now, 1) : now,
      status: lane === "done" ? "done" : "todo",
      completed_at: lane === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (data && lane === "done") after(() => remember(supabase, "task", data.id, `Did: ${title.trim()}`, now));
  refresh();
}

/* Projects, edited in place */
export async function updateProject(id: string, fields: { title?: string; description?: string; vision_id?: string | null; status?: string }) {
  const supabase = await db();
  const row: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (typeof fields.title === "string" && fields.title.trim()) row.title = fields.title.trim();
  if (typeof fields.description === "string") row.description = fields.description;
  if (fields.vision_id !== undefined) row.vision_id = fields.vision_id || null;
  if (fields.status && ["review", "active", "paused", "done", "eliminated"].includes(fields.status)) row.status = fields.status;
  await supabase.from("projects").update(row).eq("id", id);
  if (row.status && row.status !== "active") {
    const { data: p } = await supabase.from("projects").select("title").eq("id", id).single();
    if (p) after(() => remember(supabase, "project", id, `Project "${p.title}" ${row.status}`));
  }
  refresh();
}

export async function addGoal(projectId: string, title: string) {
  if (!title.trim()) return;
  const supabase = await db();
  await supabase.from("goals").insert({ project_id: projectId, title: title.trim() });
  refresh();
}

export async function renameGoal(id: string, title: string) {
  if (!title.trim()) return;
  const supabase = await db();
  await supabase.from("goals").update({ title: title.trim() }).eq("id", id);
  refresh();
}

export async function renameTask(id: string, title: string) {
  if (!title.trim()) return;
  const supabase = await db();
  await supabase.from("tasks").update({ title: title.trim() }).eq("id", id);
  refresh();
}

/* Context: your own docs, so the partner knows your life */
export async function addContextDoc(title: string, text: string): Promise<{ error?: string }> {
  const supabase = await db();
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) return { error: "That file had no readable text." };
  const { data, error } = await supabase
    .from("context_docs")
    .insert({ title: title.slice(0, 200) || "Untitled", text: clean.slice(0, 200_000), source: "upload" })
    .select("id")
    .single();
  if (error) return { error: error.message.includes("context_docs") ? "Run the 0005 setup file in Supabase first." : error.message };
  if (data) after(() => rememberDoc(supabase, data.id, title, clean));
  refresh();
  return {};
}

export async function addGoogleDoc(link: string): Promise<{ error?: string }> {
  const id = link.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? (/^[a-zA-Z0-9_-]{20,}$/.test(link.trim()) ? link.trim() : null);
  if (!id) return { error: "That doesn't look like a Google Docs link. Open the doc and copy the link from the address bar." };
  const supabase = await db();
  const doc = await readGoogleDoc(supabase, id);
  if ("error" in doc) return { error: doc.error };
  const { data, error } = await supabase
    .from("context_docs")
    .insert({ title: doc.title, text: doc.text.slice(0, 200_000), source: "gdoc", gdoc_id: id })
    .select("id")
    .single();
  if (error) return { error: error.message.includes("context_docs") ? "Run the 0005 setup file in Supabase first." : error.message };
  if (data) after(() => rememberDoc(supabase, data.id, doc.title, doc.text));
  refresh();
  return {};
}

export async function refreshGoogleDoc(id: string) {
  const supabase = await db();
  const { data: row } = await supabase.from("context_docs").select("gdoc_id").eq("id", id).single();
  if (!row?.gdoc_id) return;
  const doc = await readGoogleDoc(supabase, row.gdoc_id);
  if ("error" in doc) return;
  await supabase.from("context_docs").update({ title: doc.title, text: doc.text.slice(0, 200_000), updated_at: new Date().toISOString() }).eq("id", id);
  after(() => rememberDoc(supabase, id, doc.title, doc.text));
  refresh();
}

export async function deleteContextDoc(id: string) {
  const supabase = await db();
  await supabase.from("context_docs").delete().eq("id", id);
  await forget(supabase, "doc", id);
  refresh();
}

/* Google Drive: one link box for a single Google Doc or a whole folder */
export async function addDriveLink(link: string): Promise<{ error?: string; note?: string }> {
  const folder = link.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!folder) return addGoogleDoc(link);
  const supabase = await db();
  const { error } = await supabase.from("drive_folders").upsert({ folder_id: folder }, { onConflict: "user_id,folder_id" });
  if (error) return { error: error.message.includes("drive_folders") ? "Run the 0007 setup file in Supabase first." : error.message };
  try {
    const count = await syncDriveFolder(supabase, folder);
    refresh();
    return { note: count ? `Added ${count} doc${count === 1 ? "" : "s"} from that folder.` : "That folder has no Google Docs, Word or text files yet." };
  } catch (e) {
    await supabase.from("drive_folders").delete().eq("folder_id", folder);
    return { error: e instanceof Error ? e.message : "Couldn't open that folder." };
  }
}

export async function resyncDriveFolder(folderId: string) {
  const supabase = await db();
  await syncDriveFolder(supabase, folderId).catch((e) => console.error("drive resync", e));
  refresh();
}

export async function removeDriveFolder(folderId: string) {
  const supabase = await db();
  const { data: docs } = await supabase.from("context_docs").select("id").eq("folder_id", folderId);
  for (const d of docs ?? []) await forget(supabase, "doc", d.id);
  await supabase.from("context_docs").delete().eq("folder_id", folderId);
  await supabase.from("drive_folders").delete().eq("folder_id", folderId);
  refresh();
}

/* Routine */
const cadenceOf = (v: unknown) => (v === "daily" || v === "nightly" || v === "weekly" ? v : null);
const cleanDays = (days: number[]) => [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();

export async function addRoutine(title: string, cadence: string, weekdays: number[], times = 1, kind: "ritual" | "practice" = "ritual") {
  const c = cadenceOf(cadence);
  const days = cleanDays(weekdays);
  if (!title.trim() || !c) return;
  const supabase = await db();
  const { data: last } = await supabase.from("routines").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const row: Record<string, unknown> = { title: title.trim(), cadence: c, weekdays: c === "weekly" ? days : [], sort: (last?.sort ?? 0) + 1 };
  const t = Math.min(7, Math.max(1, Math.round(times) || 1));
  const full = { ...row, ...(c === "weekly" ? { times_per_week: days.length || t } : {}), ...(kind === "practice" ? { kind } : {}) };
  const { error } = await supabase.from("routines").insert(full);
  // Before the weekly-count or Rhythm migrations run, save without what they add.
  if (error && /times_per_week|kind/.test(error.message)) await supabase.from("routines").insert(row);
  refresh();
}

export async function updateRoutine(id: string, fields: { title?: string; cadence?: string; weekdays?: number[]; times_per_week?: number }) {
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    if (!fields.title.trim()) return;
    patch.title = fields.title.trim();
  }
  if (fields.cadence !== undefined) {
    const c = cadenceOf(fields.cadence);
    if (!c) return;
    patch.cadence = c;
    if (c !== "weekly") patch.weekdays = [];
  }
  if (fields.weekdays !== undefined) patch.weekdays = cleanDays(fields.weekdays);
  if (fields.times_per_week !== undefined) patch.times_per_week = Math.min(7, Math.max(1, Math.round(fields.times_per_week) || 1));
  const supabase = await db();
  await supabase.from("routines").update(patch).eq("id", id);
  refresh();
}

export async function deleteRoutine(id: string) {
  const supabase = await db();
  await supabase.from("routines").delete().eq("id", id);
  refresh();
}

export async function checkRoutine(id: string, day: string, done: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  const supabase = await db();
  if (done) await supabase.from("routine_checks").upsert({ routine_id: id, day }, { onConflict: "routine_id,day" });
  else await supabase.from("routine_checks").delete().eq("routine_id", id).eq("day", day);
  // Anything on that day's actions for this practice is done (or not) along with it.
  const patch = done ? { status: "done", completed_at: new Date().toISOString() } : { status: "todo", completed_at: null };
  const { error } = await supabase.from("tasks").update(patch).or(`routine_id.eq.${id},routine_ids.cs.{${id}}`).eq("day", day).in("status", done ? ["todo"] : ["done"]);
  if (error) await supabase.from("tasks").update(patch).eq("routine_id", id).eq("day", day).in("status", done ? ["todo"] : ["done"]);
  refresh();
}

/* Deleting a project takes its tasks and goals with it. */
export async function deleteProject(id: string, goBack = false) {
  const supabase = await db();
  // Gone means gone: the partner's memory of it goes too.
  // Its actions go with it, unless they're in another project too; then they just leave this one.
  let found = await supabase.from("tasks").select("*").or(`project_id.eq.${id},project_ids.cs.{${id}}`);
  if (found.error) found = await supabase.from("tasks").select("*").eq("project_id", id);
  const shared = (found.data ?? []).filter((t) => projectsOf(t).some((p) => p !== id));
  const taskIds = (found.data ?? []).filter((t) => !shared.includes(t)).map((t) => t.id);
  for (const t of shared) {
    const rest = projectsOf(t).filter((p) => p !== id);
    await supabase.from("tasks").update({ project_id: rest[0], project_ids: rest }).eq("id", t.id);
  }
  if (taskIds.length) await supabase.from("tasks").delete().in("id", taskIds);
  // A project that started as one of the partner's ideas: deleting it is eliminating that idea, so it isn't suggested again.
  const { data: proj } = await supabase.from("projects").select("title").eq("id", id).maybeSingle();
  await supabase.from("ideas").update({ status: "eliminated", status_note: "deleted from projects" }).eq("project_id", id);
  await supabase.from("projects").delete().eq("id", id);
  await supabase.from("memory").delete().eq("source_type", "project").eq("source_id", id);
  if (proj) after(() => remember(supabase, "idea", id, `Let go of "${proj.title}" (deleted it from projects)`));
  if (taskIds.length) await supabase.from("memory").delete().eq("source_type", "task").in("source_id", taskIds);
  refresh();
  if (goBack) redirect("/projects");
}

export async function reorderRoutines(ids: string[]) {
  const supabase = await db();
  await Promise.all(ids.map((id, i) => supabase.from("routines").update({ sort: i }).eq("id", id)));
  refresh();
}

/* Partner conversations */
export async function deleteConversation(id: string) {
  const supabase = await db();
  await supabase.from("conversations").delete().eq("id", id);
  revalidatePath("/partner");
}

/** Edit one schedule item in place: its words, its part of day, or its time. */
export async function editRhythm(id: string, fields: { title?: string; part_of_day?: string | null; at_time?: string | null }) {
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    if (!fields.title.trim()) return;
    patch.title = fields.title.trim();
  }
  if (fields.part_of_day !== undefined) patch.part_of_day = partOfDay(fields.part_of_day);
  if (fields.at_time !== undefined) patch.at_time = fields.at_time && /^\d{2}:\d{2}/.test(fields.at_time) ? fields.at_time : null;
  const supabase = await db();
  await supabase.from("rhythm").update(patch).eq("id", id);
  refresh();
}

/** Edit a one-time task where it sits on Schedule: words, part of day, or time. */
export async function editTask(id: string, fields: { title?: string; part_of_day?: string | null; at_time?: string | null; notes?: string | null }) {
  const patch: Record<string, unknown> = {};
  // An action's notes: the details that came with it (a post idea, the partner's why), or anything you add.
  if (fields.notes !== undefined) patch.reason = fields.notes?.trim() ? fields.notes.trim().slice(0, 4000) : null;
  if (fields.title !== undefined) {
    if (!fields.title.trim()) return;
    patch.title = fields.title.trim();
  }
  if (fields.part_of_day !== undefined) patch.part_of_day = partOfDay(fields.part_of_day);
  if (fields.at_time !== undefined) patch.at_time = fields.at_time && /^\d{2}:\d{2}/.test(fields.at_time) ? fields.at_time : null;
  const supabase = await db();
  await supabase.from("tasks").update(patch).eq("id", id);
  refresh();
}

/** Add to Schedule: every week on chosen days, or just once on a date. Either can belong to a project. */
export async function addToSchedule(input: {
  title: string;
  repeat: boolean;
  weekdays: number[];
  date: string | null;
  part_of_day: string | null;
  at_time: string | null;
  project_ids: string[];
  practice_ids?: string[];
}) {
  const title = input.title.trim();
  if (!title) return;
  const supabase = await db();
  const part_of_day = partOfDay(input.part_of_day);
  const at_time = input.at_time && /^\d{2}:\d{2}/.test(input.at_time) ? input.at_time : null;
  const projectList = ids(input.project_ids ?? []);
  const practiceList = ids(input.practice_ids ?? []);
  const project_id = projectList[0] ?? null;
  const practice = practiceList[0] ? { routine_id: practiceList[0] } : {};
  const many = { project_ids: projectList, routine_ids: practiceList };
  if (input.repeat) {
    const days = [...new Set(input.weekdays.filter((w) => Number.isInteger(w) && w >= 0 && w <= 6))];
    if (!days.length) return;
    await supabase.from("rhythm").insert(days.map((weekday) => ({ title, weekday, at_time, part_of_day, project_id, ...practice, sort: 100 })));
    // If it repeats on today's weekday, put it on Today now rather than waiting for tomorrow morning.
    const day = today();
    if (days.includes(new Date(day + "T12:00:00Z").getUTCDay())) {
      await supabase.from("tasks").insert({ title, day, at_time, part_of_day, project_id, ...practice, source: "rhythm" });
    }
  } else {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return;
    const row: Record<string, unknown> = { title, day: input.date, at_time, part_of_day, project_id, ...practice };
    const { error } = await supabase.from("tasks").insert({ ...row, ...many });
    if (error) await supabase.from("tasks").insert(row);
  }
  refresh();
}



const ids = (list: string[]) => [...new Set(list.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];

/** Put an action in any number of projects (or none). The first is kept as its main one. */
export async function setTaskProjects(id: string, projectIds: string[]) {
  const supabase = await db();
  const list = ids(projectIds);
  const { error } = await supabase.from("tasks").update({ project_id: list[0] ?? null, project_ids: list }).eq("id", id);
  if (error) await supabase.from("tasks").update({ project_id: list[0] ?? null }).eq("id", id);
  refresh();
}

/** Keep a step your partner suggested for a project: it goes to Up next. Or let it go. */
export async function answerProjectSuggestion(id: string, keep: boolean) {
  const supabase = await db();
  if (keep) await supabase.from("tasks").update({ status: "todo", day: UNDATED, accepted_at: new Date().toISOString() }).eq("id", id);
  else await supabase.from("tasks").update({ status: "skipped" }).eq("id", id);
  refresh();
}

/** Mark an action as a session of any of your practices (or none). */
export async function setTaskPractices(id: string, practiceIds: string[]) {
  const supabase = await db();
  const list = ids(practiceIds);
  const { error } = await supabase.from("tasks").update({ routine_id: list[0] ?? null, routine_ids: list }).eq("id", id);
  if (error) await supabase.from("tasks").update({ routine_id: list[0] ?? null }).eq("id", id);
  refresh();
}

/** Rhythm: whether an item is a ritual (tends you) or a practice (what you make and offer). */
export async function setRoutineKind(id: string, kind: "ritual" | "practice") {
  if (kind !== "ritual" && kind !== "practice") return;
  const supabase = await db();
  await supabase.from("routines").update({ kind }).eq("id", id);
  refresh();
}

/** Link a practice to a project it feeds, or unlink it. */
export async function linkRoutineProject(routineId: string, projectId: string, on: boolean) {
  const supabase = await db();
  if (on) await supabase.from("routine_projects").upsert({ routine_id: routineId, project_id: projectId }, { onConflict: "routine_id,project_id" });
  else await supabase.from("routine_projects").delete().eq("routine_id", routineId).eq("project_id", projectId);
  refresh();
}

/** Edit a saved journal entry in place. Its memory is rewritten so the partner reads the current version. */
export async function updateJournal(id: string, body: string) {
  if (!body.trim()) return;
  const supabase = await db();
  const { data: entry } = await supabase.from("journal_entries").update({ body: body.trim(), updated_at: new Date().toISOString() }).eq("id", id).select("id, day, prompt, body").single();
  if (entry) after(() => remember(supabase, "journal", entry.id, journalText(entry), entry.day));
  if (entry) after(() => movesFromJournal(supabase, { id: entry.id, body: entry.body }));
  refresh();
}

/** When a Rhythm item happens: part of day and an optional time. */
export async function editRoutineWhen(id: string, fields: { part_of_day?: string | null; at_time?: string | null; title?: string }) {
  const patch: Record<string, unknown> = {};
  if (fields.part_of_day !== undefined) patch.part_of_day = partOfDay(fields.part_of_day);
  if (fields.at_time !== undefined) patch.at_time = fields.at_time && /^\d{2}:\d{2}/.test(fields.at_time) ? fields.at_time : null;
  if (fields.title !== undefined) {
    if (!fields.title.trim()) return;
    patch.title = fields.title.trim();
  }
  const supabase = await db();
  await supabase.from("routines").update(patch).eq("id", id);
  refresh();
}

/** Let a post idea go: it won't be suggested again. */
export async function letGoOfIdea(id: string) {
  const supabase = await db();
  const { data: idea } = await supabase.from("ideas").update({ status: "eliminated" }).eq("id", id).select("title").single();
  if (idea) after(() => remember(supabase, "idea", id, `Passed on idea "${idea.title}"`));
  refresh();
}

/** Accept a project in review: it becomes In progress, and its actions start showing in Actions, Schedule and Today. */
export async function acceptProject(id: string) {
  const supabase = await db();
  await supabase.from("projects").update({ status: "active" }).eq("id", id);
  refresh();
}


/** Add a project straight onto the board, in the column you typed it in. */
export async function createProject(title: string, status: string): Promise<{ id?: string }> {
  if (!title.trim()) return {};
  const s = ["review", "active", "paused", "done"].includes(status) ? status : "active";
  const supabase = await db();
  let res = await supabase.from("projects").insert({ title: title.trim(), status: s }).select("id").single();
  if (res.error && s === "review") res = await supabase.from("projects").insert({ title: title.trim(), status: "paused" }).select("id").single();
  refresh();
  return { id: res.data?.id };
}

/* Portfolio: the public site at truetomax.com */
function refreshSite() {
  revalidatePath("/portfolio");
  revalidatePath("/site", "layout");
}

/** New photos land at the end of their section, in the order you picked them. */
export async function addPortfolioItems(items: { section: string; image_path: string; width: number; height: number }[]) {
  if (!items.length) return;
  const supabase = await db();
  const { data: last } = await supabase.from("portfolio_items").select("sort").eq("section", items[0].section).order("sort", { ascending: false }).limit(1).maybeSingle();
  const start = (last?.sort ?? 0) + 1;
  // Each new piece takes the next catalogue number in its section (before 0027 runs, without one).
  const { data: top } = await supabase.from("portfolio_items").select("number").eq("section", items[0].section).not("number", "is", null).order("number", { ascending: false }).limit(1).maybeSingle();
  const first = (top?.number ?? 0) + 1;
  const { error } = await supabase.from("portfolio_items").insert(items.map((it, i) => ({ ...it, sort: start + i, number: first + i })));
  if (error) await supabase.from("portfolio_items").insert(items.map((it, i) => ({ ...it, sort: start + i })));
  refreshSite();
}

export async function updatePortfolioItem(id: string, fields: { title?: string | null; description?: string | null; published?: boolean }) {
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) patch.title = fields.title?.trim() || null;
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (fields.published !== undefined) patch.published = fields.published;
  const supabase = await db();
  await supabase.from("portfolio_items").update(patch).eq("id", id);
  refreshSite();
}

export async function reorderPortfolio(ids: string[]) {
  const supabase = await db();
  const results = await Promise.all(ids.map((id, i) => supabase.from("portfolio_items").update({ sort: i + 1 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) console.error("reorderPortfolio", failed.error.message);
  refreshSite();
}

/** Removes the photo from the site and from storage. */
export async function deletePortfolioItem(id: string) {
  const supabase = await db();
  const { data } = await supabase.from("portfolio_items").select("image_path").eq("id", id).maybeSingle();
  await supabase.from("portfolio_items").delete().eq("id", id);
  if (data?.image_path) await supabase.storage.from("portfolio").remove([data.image_path]);
  refreshSite();
}
