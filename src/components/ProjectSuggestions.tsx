"use client";

import { useTransition } from "react";
import { answerProjectSuggestion } from "@/app/actions";
import { AskPartner } from "./AskPartner";

type Step = { id: string; title: string; reason: string | null };

/** Next steps your partner suggests for this project. Keep one and it goes to Up next. */
export function ProjectSuggestions({ projectId, steps }: { projectId: string; steps: Step[] }) {
  const [pending, start] = useTransition();
  return (
    <div className={pending ? "opacity-70" : ""}>
      {steps.length > 0 && (
        <ul className="divide-y divide-line">
          {steps.map((s) => (
            <li key={s.id} className="py-3">
              <p className="font-medium">{s.title}</p>
              {s.reason && <p className="mt-0.5 text-sm text-muted">{s.reason}</p>}
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
