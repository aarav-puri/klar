/**
 * Normalized academic data model shared by the web app, the extension and
 * the server. Everything here is source-agnostic: the extension page reader
 * and the official Schoology API mapper both produce these shapes.
 */

export type AssignmentStatus =
  /** A score has been entered. */
  | "graded"
  /** The teacher explicitly flagged the item as missing. */
  | "missing"
  /** Excused: never counts toward the grade. */
  | "excused"
  /** Marked incomplete by the teacher. */
  | "incomplete"
  /** No score entered yet and no exception flag. */
  | "ungraded";

export interface Assignment {
  id: string;
  courseId: string;
  categoryId: string | null;
  periodId: string | null;
  title: string;
  /** ISO 8601 timestamp, or null when the source has no due date. */
  dueAt: string | null;
  earned: number | null;
  possible: number | null;
  status: AssignmentStatus;
  late: boolean;
  /** Extra credit: earned points add to the numerator only. */
  extraCredit: boolean;
  /** When we first observed the current score (not always the teacher's timestamp). */
  gradedAt: string | null;
  comment: string | null;
  url: string | null;
}

export interface GradingCategory {
  id: string;
  name: string;
  /** Percent weight (e.g. 40 for 40%). Null when unweighted or unknown. */
  weight: number | null;
}

export interface GradingPeriod {
  id: string;
  title: string;
}

export type GradingMethod = "total_points" | "weighted_categories";

/**
 * Where a configuration value came from. Anything other than "schoology"
 * must be surfaced in the UI as an estimate.
 */
export type ConfigSource = "schoology" | "inferred" | "assumed";

export interface LetterCutoff {
  letter: string;
  /** Inclusive minimum percentage. */
  min: number;
}

export interface GradingConfig {
  method: GradingMethod;
  methodSource: ConfigSource;
  categories: GradingCategory[];
  /** Decimal places the source rounds to. Null means unknown (no rounding applied). */
  roundingDecimals: number | null;
  scale: LetterCutoff[];
  scaleSource: ConfigSource;
  /**
   * How flagged-missing items without an entered score are treated.
   * Schoology only counts a missing item once the teacher enters a score,
   * so "exclude" is the faithful default.
   */
  missingPolicy: "exclude" | "zero";
}

export interface Course {
  id: string;
  name: string;
  teacher: string | null;
  sectionName: string | null;
  /** The grade Schoology itself reports, when visible. */
  reportedPercent: number | null;
  reportedLetter: string | null;
  config: GradingConfig;
  periods: GradingPeriod[];
}

export interface GradeSnapshot {
  courseId: string;
  capturedAt: string;
  percent: number | null;
  letter: string | null;
}
