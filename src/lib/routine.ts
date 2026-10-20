import { weekdayOf } from "./dates";

export type Routine = { id: string; title: string; cadence: "daily" | "nightly" | "weekly"; weekdays: number[]; sort: number };

export const CADENCES = [
  { value: "daily", label: "Daily" },
  { value: "nightly", label: "Nightly" },
  { value: "weekly", label: "Weekly" },
] as const;

/** Whether a routine item belongs to a given day. */
export function isDue(r: Routine, day: string) {
  return r.cadence !== "weekly" || (r.weekdays ?? []).includes(weekdayOf(day));
}

export const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
