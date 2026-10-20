/** An action's projects and practices. The lists win when set; otherwise the single link (from before 0022). */
type Linked = { project_id?: string | null; project_ids?: string[] | null; routine_id?: string | null; routine_ids?: string[] | null };

export const projectsOf = (t: Linked): string[] => (t.project_ids?.length ? t.project_ids : t.project_id ? [t.project_id] : []);
export const practicesOf = (t: Linked): string[] => (t.routine_ids?.length ? t.routine_ids : t.routine_id ? [t.routine_id] : []);

/** Shown unless every project it's in is outside In progress. */
export const inActiveWork = (t: Linked, active: Set<string>) => {
  const ps = projectsOf(t);
  return !ps.length || ps.some((p) => active.has(p));
};

/** "Yoga, Music business": names for a list of ids. */
export const namesOf = (ids: string[], names: Map<string, string>) =>
  ids
    .map((id) => names.get(id))
    .filter(Boolean)
    .join(", ") || null;
