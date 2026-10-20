import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, shortDay } from "@/lib/dates";
import { getStats } from "@/lib/learn";
import { setInsightStatus, addInsight, answerRhythmProposal, markReviewSeen } from "@/app/actions";
import { AskPartner } from "@/components/AskPartner";
import { ActionButton } from "@/components/DeleteButton";

type Insight = { id: string; statement: string; evidence: string | null; kind: string; confidence: number; status: string; your_note: string | null };

/** Everything the partner has learned, with what needs your answer first. Shown as the Learned tab on Partner. */
export async function Learned() {
  const supabase = await createClient();
  const [reviews, insights, proposals, rhythm, ctx, stats] = await Promise.all([
    supabase.from("reviews").select("id, week_of, body, seen").order("created_at", { ascending: false }).limit(6),
    supabase.from("insights").select("*").neq("status", "retired").order("confidence", { ascending: false }),
    supabase.from("rhythm_proposals").select("*").eq("status", "proposed").order("created_at"),
    supabase.from("rhythm").select("id, weekday, title"),
    supabase.from("profile_context").select("summary, policy, last_learned_at").maybeSingle(),
    getStats(supabase, 42),
  ]);

  const all = (insights.data ?? []) as Insight[];
  const proposed = all.filter((i) => i.status === "proposed");
  const confirmed = all.filter((i) => i.status === "confirmed");
  const rejected = all.filter((i) => i.status === "rejected");
  const latest = reviews.data?.[0];
  const rhythmTitle = new Map((rhythm.data ?? []).map((r) => [r.id, `${r.title} on ${WEEKDAYS[r.weekday]}`]));
  const policy = (ctx.data?.policy ?? {}) as { max_suggestions?: number; preferred_size?: string; lean_into?: string[]; ease_off?: string[]; notes?: string };
  const weeks = Object.entries(stats.data.weeks);

  return (
    <div className="space-y-14">
      {proposed.length > 0 && (
        <section aria-labelledby="hunches">
          <h2 id="hunches" className="section-title">Is this true?</h2>
          <p className="mt-1 text-sm text-muted">Things it thinks it&rsquo;s learned. Confirmed ones steer every suggestion; rejected ones are never acted on.</p>
          <ul className="mt-4 space-y-4">
            {proposed.map((i) => (
              <li key={i.id} className="pebble bg-surface p-4">
                <p className="font-semibold">{i.statement}</p>
                {i.evidence && <p className="mt-1 text-sm text-muted">{i.evidence}</p>}
                <p className="mt-1 text-xs text-muted">{Math.round(i.confidence * 100)}% sure</p>
                <form action={setInsightStatus} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <input name="note" placeholder="Add a correction or nuance (optional)" aria-label="Your note" className="field min-w-0 flex-1 basis-full !py-1.5 text-sm sm:basis-auto" />
                  <button name="status" value="confirmed" className="btn-quiet !border-ink !text-ink">That&rsquo;s true</button>
                  <button name="status" value="rejected" className="btn-quiet">Not true</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(proposals.data ?? []).length > 0 && (
        <section aria-labelledby="rhythm-changes">
          <h2 id="rhythm-changes" className="section-title">Suggested rhythm changes</h2>
          <ul className="mt-4 space-y-3">
            {(proposals.data ?? []).map((p) => (
              <li key={p.id} className="pebble border border-line p-4">
                <p className="font-semibold">
                  {p.action === "add" && `Add "${p.title}" on ${WEEKDAYS[p.weekday]}`}
                  {p.action === "remove" && `Remove ${rhythmTitle.get(p.rhythm_id) ?? "a rhythm item"}`}
                  {p.action === "move" && `Move ${rhythmTitle.get(p.rhythm_id) ?? "a rhythm item"} to ${WEEKDAYS[p.to_weekday]}`}
                </p>
                <p className="mt-1 text-sm text-muted">{p.reason}</p>
                <div className="mt-3 flex gap-2">
                  <ActionButton action={answerRhythmProposal.bind(null, p.id, true)} className="btn-quiet !border-ink !text-ink">Make the change</ActionButton>
                  <ActionButton action={answerRhythmProposal.bind(null, p.id, false)}>Keep it as is</ActionButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latest && (
        <section aria-labelledby="review" className="border-l border-ink pl-4 sm:pl-5">
          <h2 id="review" className="section-title">Week of {shortDay(latest.week_of)}</h2>
          <div className="mt-3 max-w-[65ch] space-y-3 font-serif text-lg leading-relaxed">
            {latest.body.split(/\n{2,}/).map((para: string, i: number) => <p key={i} className="whitespace-pre-wrap">{para}</p>)}
          </div>
          {!latest.seen && (
            <div className="mt-4">
              <ActionButton action={markReviewSeen.bind(null, latest.id)}>Got it</ActionButton>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="confirmed">
        <h2 id="confirmed" className="section-title">True about you</h2>
        {confirmed.length ? (
          <ul className="mt-3 divide-y divide-line">
            {confirmed.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p>{i.statement}</p>
                  {i.your_note && <p className="mt-0.5 text-sm text-muted">Your note: {i.your_note}</p>}
                </div>
                <form action={setInsightStatus}>
                  <input type="hidden" name="id" value={i.id} />
                  <button name="status" value="retired" className="text-xs text-muted hover:text-ink">No longer true</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Nothing confirmed yet. After your first week it&rsquo;ll start proposing patterns for you to check.</p>
        )}
        <form action={addInsight} className="mt-4 flex gap-2">
          <input name="statement" required placeholder="Teach it something directly, e.g. I do my best creative work before noon" aria-label="Something true about you" className="field min-w-0 flex-1" />
          <button className="btn">Add</button>
        </form>
      </section>

      <section aria-labelledby="results">
        <h2 id="results" className="section-title">Results, last 6 weeks</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Moves per week</caption>
            <thead className="text-left text-muted">
              <tr><th className="py-1 font-normal">Week of</th><th className="font-normal">Shared</th><th className="font-normal">Asked</th><th className="font-normal">Booked</th><th className="font-normal">Sold</th><th className="font-normal">Earned</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {weeks.map(([w, v]) => (
                <tr key={w}>
                  <td className="py-1.5">{shortDay(w)}</td>
                  <td>{v.shared}</td><td>{v.asked}</td><td>{v.booked}</td><td>{v.sold}</td><td>${v.money.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          Partner suggestions: {stats.data.partner.offered} offered, {stats.data.partner.accepted} accepted, {stats.data.partner.done} done.
        </p>
        {Object.keys(stats.data.byCategory).length > 0 && (
          <ul className="mt-3 space-y-2">
            {Object.entries(stats.data.byCategory).map(([cat, t]) => (
              <li key={cat}>
                <div className="flex justify-between text-sm"><span className="capitalize">{cat}</span><span className="text-muted">{t.done} of {t.offered} done</span></div>
                <div className="mt-1 h-[2px] overflow-hidden bg-line">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${t.offered ? (t.done / t.offered) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(ctx.data?.summary || policy.notes) && (
        <section aria-labelledby="approach">
          <h2 id="approach" className="section-title">How it&rsquo;s guiding you now</h2>
          {policy.notes && <p className="mt-2 max-w-[65ch]">{policy.notes}</p>}
          <dl className="mt-3 space-y-1 text-sm">
            {policy.max_suggestions && <div><dt className="inline text-muted">Suggestions per day: </dt><dd className="inline">{policy.max_suggestions}{policy.preferred_size ? `, mostly ${policy.preferred_size}` : ""}</dd></div>}
            {policy.lean_into?.length ? <div><dt className="inline text-muted">Pushing more: </dt><dd className="inline">{policy.lean_into.join(", ")}</dd></div> : null}
            {policy.ease_off?.length ? <div><dt className="inline text-muted">Easing off: </dt><dd className="inline">{policy.ease_off.join(", ")}</dd></div> : null}
          </dl>
          {ctx.data?.summary && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-muted">Its read on you</h3>
              <p className="mt-1 max-w-[65ch] font-serif text-lg leading-relaxed whitespace-pre-wrap">{ctx.data.summary}</p>
            </>
          )}
        </section>
      )}

      {rejected.length > 0 && (
        <section aria-labelledby="rejected">
          <h2 id="rejected" className="section-title">You said these aren&rsquo;t true</h2>
          <ul className="mt-2 space-y-2 text-muted">
            {rejected.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3">
                <span><span className="line-through decoration-line">{i.statement}</span>{i.your_note ? `: ${i.your_note}` : ""}</span>
                <form action={setInsightStatus}>
                  <input type="hidden" name="id" value={i.id} />
                  <button name="status" value="proposed" className="shrink-0 text-xs hover:text-ink">Reconsider</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="flex flex-wrap items-center gap-3 border-t border-line pt-6 text-sm text-muted">
        <span>
          It learns on its own once a week{ctx.data?.last_learned_at ? `, last on ${new Date(ctx.data.last_learned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.
        </span>
        <AskPartner endpoint="/api/learn" label="Run now" busyLabel="Reading everything… this takes a minute" className="underline decoration-line underline-offset-4 hover:text-ink" />
      </footer>
    </div>
  );
}
