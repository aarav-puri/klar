import { computeGrade, countedPoints, GPA_POINTS, gpaLetter, type GradeResult } from "./grades";
import type { Assignment, GradingConfig, LetterCutoff } from "./types";

/**
 * Decision support built on the grade engine: what's at stake, why a grade
 * moved, where points were lost, and what a goal takes. Every number here is
 * computed from the student's real assignments with computeGrade, never
 * estimated from trends.
 */

/** Work that can still earn points: no score yet, a point value, not extra credit. */
export function isRemaining(a: Assignment): boolean {
  return a.status === "ungraded" && a.earned === null && a.possible !== null && a.possible > 0 && !a.extraCredit;
}

const withScores = (assignments: Assignment[], scores: Map<string, number>): Assignment[] =>
  assignments.map((a) => (scores.has(a.id) ? { ...a, earned: scores.get(a.id)!, status: "graded" as const, extraCredit: false } : a));

/* ------------------------------------------------------------------------ */
/* Stakes                                                                   */
/* ------------------------------------------------------------------------ */

export interface Swing {
  /** Course grade with a zero on this assignment. */
  atZero: number;
  /** Course grade with full marks on it. */
  atFull: number;
  /** Percentage points between the two: how much this one item can move the grade. */
  swing: number;
}

/** How far one unscored assignment can move the course grade, everything else unchanged. */
export function assignmentSwing(assignments: Assignment[], config: GradingConfig, assignmentId: string): Swing | null {
  const target = assignments.find((a) => a.id === assignmentId);
  if (!target?.possible || target.possible <= 0) return null;
  const at = (earned: number) => computeGrade(withScores(assignments, new Map([[assignmentId, earned]])), config).rawPercent;
  const atZero = at(0);
  const atFull = at(target.possible);
  if (atZero === null || atFull === null) return null;
  return { atZero, atFull, swing: atFull - atZero };
}

export interface MissingRecovery {
  /** Grade change if the work is turned in and earns full marks. */
  ifFull: number;
  /** Grade change if the teacher enters a zero. */
  ifZero: number;
}

/**
 * What a missing item is worth. Schoology leaves unscored missing work out of
 * the grade, so both outcomes are measured against the grade as it is now.
 */
export function missingRecovery(assignments: Assignment[], config: GradingConfig, assignmentId: string): MissingRecovery | null {
  const target = assignments.find((a) => a.id === assignmentId);
  if (!target || target.status !== "missing" || target.earned !== null || !target.possible || target.possible <= 0) return null;
  const now = computeGrade(assignments, config).rawPercent;
  const s = assignmentSwing(assignments, config, assignmentId);
  if (now === null || !s) return null;
  return { ifFull: s.atFull - now, ifZero: s.atZero - now };
}

/* ------------------------------------------------------------------------ */
/* Explaining the grade                                                     */
/* ------------------------------------------------------------------------ */

export interface CategoryLoss {
  categoryId: string;
  name: string;
  /** Percentage points of the course grade lost in this category. */
  lost: number;
  percent: number;
}

/**
 * Where the gap between the grade and 100% comes from. A category's loss is
 * its current share of the grade times what's missing from a perfect score,
 * so the losses add up to 100 minus the grade.
 */
export function pointsLost(result: GradeResult): CategoryLoss[] {
  return result.categories
    .filter((c) => c.percent !== null && c.effectiveWeight > 0)
    .map((c) => ({ categoryId: c.categoryId, name: c.name, percent: c.percent!, lost: (c.effectiveWeight / 100) * (100 - c.percent!) }))
    .sort((a, b) => b.lost - a.lost);
}

export interface Impact {
  assignment: Assignment;
  /** Percentage points this score adds to (positive) or takes from (negative) the grade. */
  impact: number;
}

/** Each counted score's effect on the grade: the grade now minus the grade without it. */
export function assignmentImpacts(assignments: Assignment[], config: GradingConfig): Impact[] {
  const now = computeGrade(assignments, config).rawPercent;
  if (now === null) return [];
  const out: Impact[] = [];
  for (const a of assignments) {
    if (!countedPoints(a, config.missingPolicy)) continue;
    const without = computeGrade(
      assignments.filter((x) => x.id !== a.id),
      config,
    ).rawPercent;
    if (without !== null) out.push({ assignment: a, impact: now - without });
  }
  return out.sort((x, y) => x.impact - y.impact);
}

export interface ChangeStep {
  assignment: Assignment;
  /** Grade change this score caused, in the order the scores were posted. */
  delta: number | null;
}

export interface ChangeExplanation {
  before: number | null;
  after: number | null;
  steps: ChangeStep[];
}

/**
 * Why a grade moved since a moment in time: the scores posted after it,
 * replayed in posting order so each step's delta is exactly what that score
 * did, and the steps add up to the whole change.
 */
export function explainChange(assignments: Assignment[], config: GradingConfig, sinceIso: string): ChangeExplanation {
  const since = Date.parse(sinceIso);
  const fresh = assignments
    .filter((a) => a.earned !== null && a.gradedAt !== null && Date.parse(a.gradedAt) > since)
    .sort((a, b) => a.gradedAt!.localeCompare(b.gradedAt!));
  const freshIds = new Set(fresh.map((a) => a.id));
  let state = assignments.map((a) => (freshIds.has(a.id) ? { ...a, earned: null, status: "ungraded" as const } : a));
  const before = computeGrade(state, config).rawPercent;
  let prev = before;
  const steps: ChangeStep[] = [];
  for (const a of fresh) {
    state = state.map((x) => (x.id === a.id ? a : x));
    const next = computeGrade(state, config).rawPercent;
    steps.push({ assignment: a, delta: prev === null || next === null ? null : next - prev });
    prev = next;
  }
  return { before, after: prev, steps };
}

/* ------------------------------------------------------------------------ */
/* Goals                                                                    */
/* ------------------------------------------------------------------------ */

export interface GoalPath {
  /** Average needed across all remaining posted work, in percent. */
  neededAverage: number;
  achievable: boolean;
  /** True when even zeros on everything left keep the target. */
  alreadySecured: boolean;
  /** Where the grade lands if the student keeps scoring their current average. */
  atCurrentPace: number | null;
  /** The best possible finish: full marks on everything left. */
  best: number;
  remainingCount: number;
  remainingPoints: number;
}

/**
 * The average score needed on every remaining posted assignment to finish at
 * `targetPercent`. With the same fraction on each remaining item the grade is
 * linear in that fraction, so two evaluations give an exact answer.
 */
export function goalPath(assignments: Assignment[], config: GradingConfig, targetPercent: number): GoalPath | null {
  const remaining = assignments.filter(isRemaining);
  if (remaining.length === 0) return null;
  const at = (fraction: number) =>
    computeGrade(withScores(assignments, new Map(remaining.map((a) => [a.id, fraction * a.possible!]))), config).rawPercent;
  const zero = at(0);
  const full = at(1);
  if (zero === null || full === null) return null;
  const current = computeGrade(assignments, config).rawPercent;
  const base = {
    atCurrentPace: current === null ? null : at(current / 100),
    best: full,
    remainingCount: remaining.length,
    remainingPoints: remaining.reduce((s, a) => s + a.possible!, 0),
  };
  if (zero >= targetPercent) return { ...base, neededAverage: 0, achievable: true, alreadySecured: true };
  const slope = full - zero;
  if (slope <= 0) return null;
  const needed = ((targetPercent - zero) / slope) * 100;
  return { ...base, neededAverage: needed, achievable: needed <= 100 + 1e-9, alreadySecured: false };
}

export interface LetterPosition {
  letter: string;
  /** Points above the current letter's cutoff. Null for the lowest letter. */
  cushion: number | null;
  /** The next letter up and how far away it is. Null at the top. */
  next: { letter: string; min: number; gap: number } | null;
}

export function letterPosition(percent: number | null, scale: LetterCutoff[]): LetterPosition | null {
  if (percent === null || scale.length === 0) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  const i = sorted.findIndex((c) => percent >= c.min);
  if (i === -1) return null;
  const cur = sorted[i]!;
  const up = i > 0 ? sorted[i - 1]! : null;
  return {
    letter: cur.letter,
    cushion: i === sorted.length - 1 ? null : percent - cur.min,
    next: up ? { letter: up.letter, min: up.min, gap: up.min - percent } : null,
  };
}

/* ------------------------------------------------------------------------ */
/* GPA                                                                      */
/* ------------------------------------------------------------------------ */

export type CourseLevel = "standard" | "honors" | "ap";

/** Common weighting: +0.5 for Honors, +1.0 for AP and IB. Failing grades get no bonus. */
export const LEVEL_BONUS: Record<CourseLevel, number> = { standard: 0, honors: 0.5, ap: 1 };

/** Guess a course's level from its name. The student can always override it. */
export function detectLevel(name: string): CourseLevel {
  if (/\b(AP|IB)\b/.test(name)) return "ap";
  if (/\bhonou?rs?\b|\(H\)|\bH$/i.test(name)) return "honors";
  return "standard";
}

export function weightedGpa(courses: { percent: number | null; letter: string | null; level: CourseLevel }[]): { gpa: number | null; courseCount: number } {
  const points: number[] = [];
  for (const c of courses) {
    const letter = gpaLetter(c);
    if (!letter) continue;
    const base = GPA_POINTS[letter]!;
    points.push(base + (base > 0 ? LEVEL_BONUS[c.level] : 0));
  }
  if (points.length === 0) return { gpa: null, courseCount: 0 };
  return { gpa: Math.round((points.reduce((s, p) => s + p, 0) / points.length) * 100) / 100, courseCount: points.length };
}
