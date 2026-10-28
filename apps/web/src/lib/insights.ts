import {
  computeGrade,
  cutoffFloor,
  detectLevel,
  goalPath,
  gpaLetter,
  letterFor,
  letterPosition,
  requiredScore,
  type CourseLevel,
  type GoalPath,
} from "@klar/core";
import type { CourseView } from "@/server/data/types";
import type { AssignmentRow } from "./workload";

const DAY = 86_400_000;

/**
 * High stakes is relative: early in a term every item swings a grade a lot,
 * so only the biggest items in the list (and at least 5 points) are called out.
 */
export function highStakesThreshold(swings: number[]): number {
  return Math.max(5, 0.6 * Math.max(0, ...swings));
}

export interface FocusItem {
  row: AssignmentRow;
  swing: number;
  /** Fractional days until due; 0 when due now. */
  days: number;
  /** Lowest score on this item that keeps the current letter, when there's one to keep. */
  keep: { letter: string; needed: number; possible: number; alreadySecured: boolean; achievable: boolean } | null;
}

/**
 * Upcoming work ranked by what it can do to a grade, discounted by how far
 * off it is: a big test next week can outrank a tiny worksheet due tomorrow.
 */
export function focusQueue(rows: AssignmentRow[], courses: CourseView[], now: Date, { days = 14, limit = 6 } = {}): FocusItem[] {
  const byId = new Map(courses.map((c) => [c.id, c]));
  const end = now.getTime() + days * DAY;
  const items: (FocusItem & { priority: number })[] = [];
  for (const row of rows) {
    if (row.swing === null || !row.dueAt) continue;
    const due = Date.parse(row.dueAt);
    if (due < now.getTime() - 3_600_000 || due > end) continue;
    const d = Math.max(0, (due - now.getTime()) / DAY);
    items.push({ row, swing: row.swing, days: d, keep: keepLetter(byId.get(row.courseId), row), priority: row.swing / (1 + d / 3) });
  }
  return items.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

function keepLetter(course: CourseView | undefined, row: AssignmentRow): FocusItem["keep"] {
  if (!course || !row.possible) return null;
  const current = computeGrade(course.assignments, course.config).percent;
  const pos = letterPosition(current, course.config.scale);
  if (!pos || pos.cushion === null) return null;
  const min = current! - pos.cushion;
  const r = requiredScore(course.assignments, course.config, { assignmentId: row.id, possible: row.possible, targetPercent: min });
  if (!r) return null;
  return { letter: pos.letter, needed: Math.max(0, Math.ceil(r.needed * 10) / 10), possible: r.possible, alreadySecured: r.alreadySecured, achievable: r.achievable };
}

export type GoalTone = "success" | "brand" | "warning" | "danger";

export const GOAL_TONE_CLASS: Record<GoalTone, string> = {
  success: "font-bold text-success",
  brand: "font-bold text-brand-ink",
  warning: "font-bold text-warning",
  danger: "font-bold text-danger",
};

export interface GoalStatus {
  goal: number;
  goalLetter: string | null;
  /** Klar's calculation of the grade right now. */
  current: number | null;
  path: GoalPath | null;
  tone: GoalTone;
  /** Short label for cards. */
  label: string;
}

/** Where a course stands against the student's goal. Null when no goal is set. */
export function goalStatus(course: CourseView): GoalStatus | null {
  const goal = course.plan.goalPercent;
  if (goal === null) return null;
  const current = computeGrade(course.assignments, course.config).percent;
  // A letter goal is met once the grade rounds up to its cutoff.
  const target = course.config.scale.some((c) => c.min === goal) ? cutoffFloor(goal) : goal;
  const path = goalPath(course.assignments, course.config, target);
  const base = { goal, goalLetter: letterFor(goal, course.config.scale), current, path };
  const at = current ?? -Infinity;
  if (path?.alreadySecured) return { ...base, tone: "success", label: "Locked in" };
  if (!path) {
    return at >= target ? { ...base, tone: "success", label: "At goal" } : { ...base, tone: "warning", label: `${(target - at).toFixed(1)} pts below goal` };
  }
  if (!path.achievable) return { ...base, tone: "danger", label: "Out of reach on posted work" };
  if (path.atCurrentPace !== null && path.atCurrentPace >= target) return { ...base, tone: "success", label: "On track" };
  return { ...base, tone: path.neededAverage > 95 ? "warning" : "brand", label: `Need ${Math.ceil(path.neededAverage)}% avg` };
}

export function effectiveLevel(course: Pick<CourseView, "name" | "plan">): CourseLevel {
  return course.plan.level ?? detectLevel(course.name);
}

/** GPA letter boundaries (A from 90, B from 80, ...), matching how unweighted GPA reads letters. */
const GPA_CUTS: [string, number][] = [
  ["A", 90],
  ["B", 80],
  ["C", 70],
  ["D", 60],
];

export interface GpaMover {
  course: CourseView;
  kind: "reach" | "risk";
  /** Grade points to the next GPA letter (reach) or above the current one's floor (risk). */
  gap: number;
  from: string;
  to: string;
}

/**
 * The courses closest to changing GPA: a little higher and they go up a
 * letter, a little lower and they drop one.
 */
export function gpaMovers(courses: CourseView[], { reach = 3, risk = 1.5 } = {}): GpaMover[] {
  const out: GpaMover[] = [];
  for (const c of courses) {
    if (c.percent === null) continue;
    const letter = gpaLetter(c);
    if (!letter) continue;
    const i = GPA_CUTS.findIndex(([l]) => l === letter);
    const up = i === -1 ? GPA_CUTS.at(-1)! : i > 0 ? GPA_CUTS[i - 1]! : null;
    const toUp = up ? cutoffFloor(up[1]) - c.percent : null;
    if (up && toUp !== null && toUp > 0 && toUp <= reach) out.push({ course: c, kind: "reach", gap: toUp, from: letter, to: up[0] });
    const floor = i === -1 ? null : GPA_CUTS[i]!;
    const below = i === -1 ? null : (GPA_CUTS[i + 1]?.[0] ?? "F");
    const aboveFloor = floor ? c.percent - cutoffFloor(floor[1]) : null;
    if (floor && below && aboveFloor !== null && aboveFloor >= 0 && aboveFloor <= risk) out.push({ course: c, kind: "risk", gap: aboveFloor, from: letter, to: below });
  }
  return out.sort((a, b) => a.gap - b.gap);
}
