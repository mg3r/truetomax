"use client";

import { useState, useTransition } from "react";
import { ActionEditor, type EditableAction } from "./ActionEditor";
import { answerProjectSuggestion } from "@/app/actions";
import { AskPartner } from "./AskPartner";

type Step = { id: string; title: string; reason: string | null; day: string | null; status: string; part_of_day?: string | null; at_time?: string | null; project_id?: string | null; routine_id?: string | null };

/** Next steps your partner suggests for this project. Keep one and it goes to Up next. */
export function ProjectSuggestions({ projectId, steps, today, practices = [] }: { projectId: string; steps: Step[]; today: string; practices?: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={pending ? "opacity-70" : ""}>
      {steps.length > 0 && (
        <ul className="divide-y divide-line">
          {steps.map((s) => (
            <li key={s.id} className="py-3">
              <StepDetails s={s} today={today} practices={practices} />
              <div className="mt-2 flex gap-2">
                <button className="btn-quiet !border-ink !text-ink" onClick={() => start(() => answerProjectSuggestion(s.id, true))}>
                  Add to Up next
                </button>
                <button className="btn-quiet" onClick={() => start(() => answerProjectSuggestion(s.id, false))}>
                  Not this
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={steps.length ? "mt-3" : ""}>
        <AskPartner
          endpoint="/api/projects/suggest"
          body={{ projectId }}
          label={steps.length ? "Suggest different steps" : "Suggest next steps"}
          busyLabel="Thinking about this project…"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        />
      </div>
    </div>
  );
}

/** A suggested step: tap its title to set when, and which practice it's a session of, before keeping it. */
function StepDetails({ s, today, practices }: { s: Step; today: string; practices: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<EditableAction>({ id: s.id, day: s.day, status: s.status, part_of_day: s.part_of_day ?? null, at_time: s.at_time ?? null, project_id: s.project_id ?? null, routine_id: s.routine_id ?? null });
  const practice = practices.find((p) => p.id === a.routine_id)?.name;
  const when = a.at_time ? a.at_time.slice(0, 5) : a.part_of_day;
  return (
    <>
      {(practice || when) && <p className="text-xs text-muted">{[practice, when].filter(Boolean).join(" · ")}</p>}
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left font-medium hover:underline hover:decoration-line hover:underline-offset-4">
        {s.title}
      </button>
      {s.reason && <p className="mt-0.5 text-sm text-muted">{s.reason}</p>}
      {open && <ActionEditor action={a} today={today} projects={[]} practices={practices} showWhere={false} onChange={(patch) => setA((x) => ({ ...x, ...patch }))} onClose={() => setOpen(false)} />}
    </>
  );
}
