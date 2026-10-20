import { ActionButton } from "./DeleteButton";
import { AskPartner } from "./AskPartner";
import { contentIdeaToTask, ideaToProject, letGoOfIdea } from "@/app/actions";

type Idea = { id: string; title: string; body: string | null; first_step: string | null; money_path: string | null };

/** Ideas from your partner, kept or let go one at a time: post ideas on Socials, project ideas on Projects. */
export function IdeaList({ kind, ideas }: { kind: "content" | "venture"; ideas: Idea[] }) {
  const projects = kind === "venture";
  return (
    <section aria-labelledby={`${kind}-ideas`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`${kind}-ideas`} className="section-title">{projects ? "project ideas" : "post ideas"}</h2>
        <AskPartner
          endpoint="/api/ideas"
          body={{ kind }}
          label={projects ? "Suggest 3 projects" : "Suggest 3 posts"}
          busyLabel="Thinking it through…"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        />
      </div>
      {ideas.length ? (
        <ul className="mt-2 divide-y divide-line">
          {ideas.map((i) => (
            <li key={i.id} className="py-3">
              <p className="font-medium">{i.title}</p>
              {i.body && <p className="mt-0.5 text-sm text-muted">{i.body}</p>}
              {i.money_path && <p className="mt-1 text-sm"><span className="text-muted">Money path: </span>{i.money_path}</p>}
              {i.first_step && <p className="mt-1 text-sm"><span className="text-muted">{projects ? "First step: " : "Next time: "}</span>{i.first_step}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {projects ? (
                  <>
                    <ActionButton action={ideaToProject.bind(null, i.id, "active")} className="btn-quiet !border-ink !text-ink">Start it</ActionButton>
                    <ActionButton action={ideaToProject.bind(null, i.id, "paused")}>Backlog</ActionButton>
                  </>
                ) : (
                  <ActionButton action={contentIdeaToTask.bind(null, i.id)} className="btn-quiet !border-ink !text-ink">Add to Up next</ActionButton>
                )}
                <ActionButton action={letGoOfIdea.bind(null, i.id)}>Not this</ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {projects ? "Ask for feasible ways to earn from what you already do." : "Ask for ideas built from what you're making this week and what's landing."}
        </p>
      )}
    </section>
  );
}
