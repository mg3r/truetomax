import { PlusButton, TrashButton } from "./IconActions";
import { AskPartner } from "./AskPartner";
import { Collapsible } from "./Collapsible";
import { contentIdeaToTask, ideaToProject, letGoOfIdea } from "@/app/actions";

type Idea = { id: string; title: string; body: string | null; first_step: string | null; money_path: string | null };

/** Ideas from your partner, kept or let go one at a time: post ideas on Socials, project ideas on Projects. */
export function IdeaList({ kind, ideas }: { kind: "content" | "venture"; ideas: Idea[] }) {
  const projects = kind === "venture";
  return (
    <Collapsible
      id={`${kind}-ideas`}
      title={projects ? "project ideas" : "post ideas"}
      count={ideas.length}
      action={
        <AskPartner
          endpoint="/api/ideas"
          body={{ kind }}
          label={projects ? "Suggest 3 projects" : "Suggest 3 posts"}
          busyLabel="Thinking it through…"
          className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
        />
      }
    >
      {ideas.length ? (
        <ul className="mt-2 divide-y divide-line">
          {ideas.map((i) => (
            <li key={i.id} className="py-3">
              <p className="font-medium">{i.title}</p>
              {i.body && <p className="mt-0.5 text-sm text-muted">{i.body}</p>}
              {i.money_path && <p className="mt-1 text-sm"><span className="text-muted">Money path: </span>{i.money_path}</p>}
              {i.first_step && <p className="mt-1 text-sm"><span className="text-muted">{projects ? "First step: " : "Next time: "}</span>{i.first_step}</p>}
              <div className="mt-2 flex gap-2">
                {projects ? (
                  <PlusButton action={ideaToProject.bind(null, i.id, "review")} label="Add to projects (In review)" done={{ text: `Added “${i.title}” to your board, In review`, href: "/projects", link: "See it" }} />
                ) : (
                  <PlusButton action={contentIdeaToTask.bind(null, i.id)} label="Add to Up next in Actions" done={{ text: "Added to Up next, with all its details", href: "/actions", link: "Open Actions" }} />
                )}
                <TrashButton action={letGoOfIdea.bind(null, i.id)} label="Delete idea" confirm={`Delete "${i.title}"? It's gone for good and won't be suggested again.`} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {projects ? "Ask for feasible ways to earn from what you already do." : "Ask for ideas built from what you're making this week and what's landing."}
        </p>
      )}
    </Collapsible>
  );
}
