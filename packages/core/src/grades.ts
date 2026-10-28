import type {
  Assignment,
  GradingCategory,
  GradingConfig,
  LetterCutoff,
} from "./types";

/**
 * Ten-point letter scale with no plus or minus. Used only when the course does
 * not expose its own scale, and always labelled as an assumption in the UI.
 */
export const DEFAULT_SCALE: LetterCutoff[] = [
  { letter: "A", min: 90 },
  { letter: "B", min: 80 },
  { letter: "C", min: 70 },
  { letter: "D", min: 60 },
  { letter: "F", min: 0 },
];

export function defaultConfig(overrides: Partial<GradingConfig> = {}): GradingConfig {
  return {
    method: "total_points",
    methodSource: "assumed",
    categories: [],
    roundingDecimals: 2,
    scale: DEFAULT_SCALE,
    scaleSource: "assumed",
    missingPolicy: "exclude",
    ...overrides,
  };
}

/** Half-up rounding that is stable for values like 89.995. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * The lowest percent that earns a cutoff once rounded to a whole number, the
 * way schools round report cards: 89.5 earns a 90 cutoff, 89.49 does not.
 */
export function cutoffFloor(min: number): number {
  return Math.ceil(min) - 0.5;
}

export function meetsCutoff(percent: number, min: number): boolean {
  return percent + 1e-9 >= cutoffFloor(min);
}

export function letterFor(percent: number | null, scale: LetterCutoff[]): string | null {
  if (percent === null || !Number.isFinite(percent) || scale.length === 0) return null;
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  for (const cutoff of sorted) {
    if (meetsCutoff(percent, cutoff.min)) return cutoff.letter;
  }
  return sorted[sorted.length - 1]?.letter ?? null;
}

export interface Counted {
  earned: number;
  possible: number;
}

/**
 * Decide how (and whether) a single assignment contributes to the grade.
 * Returns null when it must be ignored.
 */
export function countedPoints(
  a: Assignment,
  missingPolicy: GradingConfig["missingPolicy"],
): Counted | null {
  if (a.status === "excused" || a.status === "incomplete") return null;
  if (a.earned === null) {
    if (a.status === "missing" && missingPolicy === "zero" && a.possible && a.possible > 0) {
      return { earned: 0, possible: a.possible };
    }
    return null;
  }
  if (a.extraCredit) return { earned: a.earned, possible: 0 };
  return { earned: a.earned, possible: a.possible ?? 0 };
}

export interface CategoryResult {
  categoryId: string;
  name: string;
  weight: number | null;
  earned: number;
  possible: number;
  /** Null when the category has no graded work yet. */
  percent: number | null;
  gradedCount: number;
  /** Share of the final grade this category currently carries (0-100). */
  effectiveWeight: number;
}

export interface GradeResult {
  /** Unrounded percentage, or null when nothing is graded yet. */
  rawPercent: number | null;
  /** Percentage after applying the course's rounding rule. */
  percent: number | null;
  letter: string | null;
  method: GradingConfig["method"];
  earned: number;
  possible: number;
  categories: CategoryResult[];
  gradedCount: number;
  /** Plain-language notes about anything estimated or ignored. */
  assumptions: string[];
}

export interface ComputeOptions {
  /** Restrict to a grading period. Null/undefined means all periods. */
  periodId?: string | null;
}

export function computeGrade(
  assignments: Assignment[],
  config: GradingConfig,
  options: ComputeOptions = {},
): GradeResult {
  const assumptions: string[] = [];
  const scoped =
    options.periodId == null
      ? assignments
      : assignments.filter((a) => a.periodId === options.periodId);

  if (config.methodSource !== "schoology") {
    assumptions.push(
      config.method === "weighted_categories"
        ? "Category weights were inferred from your gradebook, not confirmed by Schoology."
        : "Schoology did not report category weights, so this assumes total-points grading.",
    );
  }
  if (config.scaleSource !== "schoology") {
    assumptions.push("Letter grades use a standard scale. Your teacher's scale may differ.");
  }
  if (config.roundingDecimals === null) {
    assumptions.push("Rounding rule unknown; percentages are shown unrounded.");
  }

  const known = new Map<string, GradingCategory>(config.categories.map((c) => [c.id, c]));
  const buckets = new Map<string, { earned: number; possible: number; count: number }>();
  let totalEarned = 0;
  let totalPossible = 0;
  let gradedCount = 0;
  let uncategorized = 0;
  let missingIgnored = 0;

  for (const a of scoped) {
    const counted = countedPoints(a, config.missingPolicy);
    if (!counted) {
      if (a.status === "missing" && a.earned === null) missingIgnored++;
      continue;
    }
    gradedCount++;
    totalEarned += counted.earned;
    totalPossible += counted.possible;
    const key = a.categoryId && known.has(a.categoryId) ? a.categoryId : null;
    if (key === null) {
      uncategorized++;
      if (config.method === "weighted_categories") continue;
    }
    const bucketKey = key ?? "__uncategorized";
    const bucket = buckets.get(bucketKey) ?? { earned: 0, possible: 0, count: 0 };
    bucket.earned += counted.earned;
    bucket.possible += counted.possible;
    bucket.count++;
    buckets.set(bucketKey, bucket);
  }

  if (missingIgnored > 0) {
    assumptions.push(
      `${missingIgnored} missing item${missingIgnored === 1 ? " has" : "s have"} no score entered and ${
        missingIgnored === 1 ? "is" : "are"
      } not counted, matching how Schoology calculates until a score is entered.`,
    );
  }

  const categoryResults: CategoryResult[] = config.categories.map((c) => {
    const b = buckets.get(c.id);
    const percent = b && b.possible > 0 ? (b.earned / b.possible) * 100 : null;
    return {
      categoryId: c.id,
      name: c.name,
      weight: c.weight,
      earned: b?.earned ?? 0,
      possible: b?.possible ?? 0,
      percent,
      gradedCount: b?.count ?? 0,
      effectiveWeight: 0,
    };
  });

  let raw: number | null = null;

  if (config.method === "weighted_categories") {
    if (uncategorized > 0) {
      assumptions.push(
        `${uncategorized} graded item${uncategorized === 1 ? " is" : "s are"} not in a weighted category and ${
          uncategorized === 1 ? "was" : "were"
        } left out.`,
      );
    }
    const active = categoryResults.filter(
      (c) => c.percent !== null && c.weight !== null && c.weight > 0,
    );
    const weightSum = active.reduce((s, c) => s + (c.weight ?? 0), 0);
    const declaredSum = config.categories.reduce((s, c) => s + (c.weight ?? 0), 0);
    if (active.length > 0 && weightSum > 0) {
      raw = active.reduce((s, c) => s + (c.weight ?? 0) * (c.percent ?? 0), 0) / weightSum;
      for (const c of active) c.effectiveWeight = ((c.weight ?? 0) / weightSum) * 100;
      if (weightSum < declaredSum - 1e-9) {
        assumptions.push(
          "Some categories have no graded work yet, so the remaining weights were scaled up proportionally.",
        );
      }
    }
    const extraCreditOnly = categoryResults.filter((c) => c.possible === 0 && c.earned > 0);
    if (extraCreditOnly.length > 0) {
      assumptions.push(
        "A category contains only extra credit; it cannot be weighted until it has regular points.",
      );
    }
  } else {
    if (totalPossible > 0) raw = (totalEarned / totalPossible) * 100;
    for (const c of categoryResults) {
      c.effectiveWeight = totalPossible > 0 ? (c.possible / totalPossible) * 100 : 0;
    }
  }

  const percent =
    raw === null ? null : config.roundingDecimals === null ? raw : roundTo(raw, config.roundingDecimals);

  return {
    rawPercent: raw,
    percent,
    letter: letterFor(percent, config.scale),
    method: config.method,
    earned: totalEarned,
    possible: totalPossible,
    categories: categoryResults,
    gradedCount,
    assumptions,
  };
}

/* ------------------------------------------------------------------------ */
/* What-if                                                                  */
/* ------------------------------------------------------------------------ */

export interface ScoreEdit {
  earned: number | null;
  possible: number | null;
}

export interface HypotheticalAssignment {
  id: string;
  title: string;
  categoryId: string | null;
  earned: number | null;
  possible: number;
  extraCredit?: boolean;
}

export interface WhatIfScenario {
  edits: Record<string, ScoreEdit>;
  hypotheticals: HypotheticalAssignment[];
}

export const EMPTY_SCENARIO: WhatIfScenario = { edits: {}, hypotheticals: [] };

/**
 * Produce a new assignment list with the scenario applied. The input is never
 * mutated; nothing here can reach Schoology.
 */
export function applyScenario(
  assignments: Assignment[],
  scenario: WhatIfScenario,
  courseId: string,
  periodId: string | null = null,
): Assignment[] {
  const edited = assignments.map((a) => {
    const edit = scenario.edits[a.id];
    if (!edit) return a;
    return {
      ...a,
      earned: edit.earned,
      possible: edit.possible ?? a.possible,
      status: edit.earned === null ? ("ungraded" as const) : ("graded" as const),
    };
  });
  const added: Assignment[] = scenario.hypotheticals.map((h) => ({
    id: h.id,
    courseId,
    categoryId: h.categoryId,
    periodId,
    title: h.title,
    dueAt: null,
    earned: h.earned,
    possible: h.possible,
    status: h.earned === null ? "ungraded" : "graded",
    late: false,
    extraCredit: h.extraCredit ?? false,
    gradedAt: null,
    comment: null,
    url: null,
  }));
  return [...edited, ...added];
}

export function scenarioIsEmpty(s: WhatIfScenario): boolean {
  return Object.keys(s.edits).length === 0 && s.hypotheticals.length === 0;
}

export interface RequiredScore {
  /** Points needed out of `possible`; may exceed `possible` or be negative. */
  needed: number;
  possible: number;
  achievable: boolean;
  /** True when even a zero reaches the target. */
  alreadySecured: boolean;
}

/**
 * Solve for the score needed on one assignment to reach `targetPercent`.
 * With the category set fixed, the course grade is linear in a single
 * assignment's earned points, so two evaluations give an exact answer.
 */
export function requiredScore(
  assignments: Assignment[],
  config: GradingConfig,
  target: { assignmentId: string; possible: number; targetPercent: number },
  options: ComputeOptions = {},
): RequiredScore | null {
  if (target.possible <= 0) return null;
  const withScore = (earned: number) =>
    assignments.map((a) =>
      a.id === target.assignmentId
        ? { ...a, earned, possible: target.possible, status: "graded" as const, extraCredit: false }
        : a,
    );
  const atZero = computeGrade(withScore(0), config, options).rawPercent;
  const atFull = computeGrade(withScore(target.possible), config, options).rawPercent;
  if (atZero === null || atFull === null) return null;
  if (atZero >= target.targetPercent) {
    return { needed: 0, possible: target.possible, achievable: true, alreadySecured: true };
  }
  const slope = (atFull - atZero) / target.possible;
  if (slope <= 0) return null;
  const needed = (target.targetPercent - atZero) / slope;
  return {
    needed,
    possible: target.possible,
    achievable: needed <= target.possible + 1e-9,
    alreadySecured: false,
  };
}

/* ------------------------------------------------------------------------ */
/* History                                                                  */
/* ------------------------------------------------------------------------ */

export interface Change {
  delta: number;
  from: number;
  to: number;
  since: string;
}

/**
 * Percentage-point change between the latest snapshot and the most recent
 * earlier snapshot with a different value. Returns null when there is not
 * enough real history; callers must not invent a change.
 */
export function latestChange(
  snapshots: { capturedAt: string; percent: number | null }[],
): Change | null {
  const valid = snapshots
    .filter((s): s is { capturedAt: string; percent: number } => s.percent !== null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const last = valid[valid.length - 1];
  if (!last) return null;
  for (let i = valid.length - 2; i >= 0; i--) {
    const prev = valid[i]!;
    if (Math.abs(prev.percent - last.percent) > 1e-9) {
      return {
        delta: roundTo(last.percent - prev.percent, 2),
        from: prev.percent,
        to: last.percent,
        since: prev.capturedAt,
      };
    }
  }
  return null;
}

/** Unweighted 4.0 points per letter. Plus and minus don't change the points. */
export const GPA_POINTS: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export interface UnweightedGpa {
  /** Mean of 4.0-scale points across graded courses, each counted equally. */
  gpa: number | null;
  courseCount: number;
}

/** The A-F letter a course counts as for GPA, or null when it has no grade. */
export function gpaLetter(c: { percent: number | null; letter: string | null }): string | null {
  const own = c.letter?.trim().toUpperCase().replace(/[+-]$/, "");
  const letter = own && own in GPA_POINTS ? own : letterFor(c.percent, DEFAULT_SCALE)?.[0];
  return letter && letter in GPA_POINTS ? letter : null;
}

/**
 * Unweighted GPA. Courses without a grade are left out. A course's own letter
 * is used when it is a standard letter; otherwise its percent is mapped with
 * the standard scale.
 */
export function unweightedGpa(courses: { percent: number | null; letter: string | null }[]): UnweightedGpa {
  const points: number[] = [];
  for (const c of courses) {
    const letter = gpaLetter(c);
    if (letter) points.push(GPA_POINTS[letter]!);
  }
  if (points.length === 0) return { gpa: null, courseCount: 0 };
  return { gpa: roundTo(points.reduce((s, p) => s + p, 0) / points.length, 2), courseCount: points.length };
}
