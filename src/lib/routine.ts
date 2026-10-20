import { weekdayOf, addDays } from "./dates";

export type Routine = { id: string; title: string; cadence: "daily" | "nightly" | "weekly"; weekdays: number[]; sort: number; times_per_week?: number };

export const CADENCES = [
  { value: "daily", label: "Daily" },
  { value: "nightly", label: "Nightly" },
  { value: "weekly", label: "Weekly" },
] as const;

/** A weekly item pinned to set days, rather than any day you have room. */
export const isPinned = (r: Routine) => r.cadence === "weekly" && (r.weekdays ?? []).length > 0;

/** How many times a week a weekly item is meant to happen. */
export const timesOf = (r: Routine) => (isPinned(r) ? r.weekdays.length : Math.max(1, r.times_per_week ?? 1));

/** Whether a routine item belongs to a given day. Weekly items on any day are always available. */
export function isDue(r: Routine, day: string) {
  return !isPinned(r) || r.weekdays.includes(weekdayOf(day));
}

/** Monday of the week a day falls in. */
export const mondayOf = (day: string) => addDays(day, -((weekdayOf(day) + 6) % 7));

export const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
