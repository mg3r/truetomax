import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { today, prettyDay, addDays, weekdayOf } from "@/lib/dates";
import { MoveLogger } from "@/components/Moves";
import { Star } from "@/components/Star";
import { PrepareDay } from "@/components/PrepareDay";
import { TaskRow, SuggestionRow, AddTask, type Task } from "@/components/Tasks";
import { JournalForm } from "@/components/JournalForm";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const day = today();

  const { data: d } = await supabase.from("days").select("*").eq("day", day).maybeSingle();
  if (!d?.affirmation) return <PrepareDay />;

  const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7)); // Monday
  const [highlight, tasks, projects, entry, moves, unseen, proposals, hunches] = await Promise.all([
    d.highlight_id ? supabase.from("highlights").select("text, source, location").eq("id", d.highlight_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("tasks")
      .select("id, title, status, source, reason, day, project_id, created_at")
      .or(`and(day.lte.${day},status.eq.todo),and(day.eq.${day},status.in.(done,suggested))`)
      .order("created_at"),
    supabase.from("projects").select("id, title").eq("status", "active").order("created_at"),
    supabase.from("journal_entries").select("id, body").eq("day", day).eq("prompt", d.question ?? "").maybeSingle(),
    supabase.from("moves").select("kind, amount").gte("day", weekStart),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("seen", false),
    supabase.from("rhythm_proposals").select("id", { count: "exact", head: true }).eq("status", "proposed"),
    supabase.from("insights").select("id", { count: "exact", head: true }).eq("status", "proposed"),
  ]);
  const mv = moves.data ?? [];
  const shares = mv.filter((m) => m.kind === "shared").length;
  const asks = mv.filter((m) => m.kind === "asked").length;
  const wins = mv.filter((m) => m.kind === "booked" || m.kind === "sold").length;
  const earned = mv.reduce((sum, m) => sum + Number(m.amount ?? 0), 0);
  const learnedNotes = [
    unseen.count ? "a new weekly review" : null,
    hunches.count ? `${hunches.count} thing${hunches.count === 1 ? "" : "s"} it thinks it's learned` : null,
    proposals.count ? `${proposals.count} rhythm change${proposals.count === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  const projName = new Map((projects.data ?? []).map((p) => [p.id, p.title]));
  const all: Task[] = (tasks.data ?? []).map((t) => ({ ...t, project: t.project_id ? projName.get(t.project_id) : null }));
  const suggestions = all.filter((t) => t.status === "suggested");
  // Rhythm first, then everything else; finished tasks sink to the bottom.
  const list = all
    .filter((t) => t.status !== "suggested")
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || Number(b.source === "rhythm") - Number(a.source === "rhythm"));
  const doneCount = list.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-12">
      {/* The affirmation is the one bright moment of the day. */}
      <section aria-label="Affirmation" className="pt-6">
        <p className="text-sm text-muted">{prettyDay(day)}</p>
        <div className="mt-5 flex gap-4">
          <Star size={26} className="dawn-rise mt-2 shrink-0 text-dawn" />
          <h1 className="font-serif text-[2rem] leading-[1.15] tracking-[-0.015em] sm:text-[2.6rem]">{d.affirmation}</h1>
        </div>
        {d.focus && <p className="mt-5 max-w-[60ch] border-l-2 border-dawn pl-4 text-muted">{d.focus}</p>}
      </section>

      {learnedNotes.length > 0 && (
        <Link href="/learned" className="block rounded-2xl border border-dawn/60 px-4 py-3 hover:bg-surface">
          <span className="font-semibold">Your partner has {learnedNotes.join(", ")}.</span>{" "}
          <span className="text-muted">Check it&rsquo;s right so it keeps learning the right things.</span>
        </Link>
      )}

      <section aria-labelledby="passage">
        <h2 id="passage" className="section-title">Today&rsquo;s passage</h2>
        {highlight.data ? (
          <figure className="mt-3">
            <blockquote className="font-serif text-lg leading-relaxed italic">{highlight.data.text}</blockquote>
            <figcaption className="mt-2 text-sm text-muted">
              {highlight.data.source}
              {highlight.data.location ? `, ${highlight.data.location}` : ""}
            </figcaption>
          </figure>
        ) : (
          <p className="mt-2 text-muted">
            Add passages you&rsquo;ve marked in your copy of The Creative Act and one will meet you here each morning.{" "}
            <Link href="/settings#passages" className="text-ink underline decoration-line underline-offset-4">Add passages</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="tasks">
        <div className="flex items-baseline justify-between">
          <h2 id="tasks" className="section-title">What to do today</h2>
          {list.length > 0 && <span className="text-sm text-muted">{doneCount} of {list.length} done</span>}
        </div>
        {list.length ? (
          <ul className="mt-2 divide-y divide-line">
            {list.map((t) => <TaskRow key={t.id} task={t} today={day} />)}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Nothing set for today yet. Add the one thing that would make today count.</p>
        )}
        <AddTask projects={projects.data ?? []} day={day} />

        {suggestions.length > 0 && (
          <div className="mt-8 rounded-2xl bg-surface p-4 sm:p-5">
            <h3 className="font-serif text-lg">Your partner suggests</h3>
            <ul className="divide-y divide-line">
              {suggestions.map((t) => <SuggestionRow key={t.id} task={t} />)}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="moves">
        <h2 id="moves" className="section-title">Moves this week</h2>
        <p className="mt-1 text-sm text-muted">Every time you share your work or ask someone to pay you. This is the number that changes everything else.</p>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["Shared", shares],
            ["Asked", asks],
            ["Booked or sold", wins],
            ["Earned", `$${earned.toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-col-reverse">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`font-serif text-3xl tabular-nums ${value === 0 ? "text-muted" : ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <MoveLogger />
      </section>

      <section aria-labelledby="question">
        <h2 id="question" className="section-title">Today&rsquo;s question</h2>
        <p className="mt-2 mb-4 max-w-[60ch] font-serif text-lg leading-relaxed">{d.question}</p>
        <JournalForm key={entry.data?.id ?? "new"} id={entry.data?.id} prompt={d.question} day={day} initial={entry.data?.body ?? ""} />
      </section>

      <footer className="flex justify-center">
        <PrepareDay auto={false} />
      </footer>
    </div>
  );
}
