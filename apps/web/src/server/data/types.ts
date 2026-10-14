import type { Assignment, Change, CourseLevel, GradingConfig, GradingPeriod } from "@klar/core";

export interface SnapshotPoint {
  capturedAt: string;
  percent: number | null;
}

/** The student's own settings for a course. Never sent to Schoology. */
export interface CoursePlan {
  /** Target course grade in percent. */
  goalPercent: number | null;
  /** Chosen course level, or null to use the level detected from the name. */
  level: CourseLevel | null;
}

export const EMPTY_PLAN: CoursePlan = { goalPercent: null, level: null };

export interface CourseView {
  id: string;
  name: string;
  teacher: string | null;
  sectionName: string | null;
  /** The grade shown to the student. */
  percent: number | null;
  letter: string | null;
  /** "schoology" when Schoology displayed this number; "calculated" when Klar computed it. */
  percentSource: "schoology" | "calculated";
  /** Klar's own calculation, for comparison with Schoology's number. */
  calculatedPercent: number | null;
  change: Change | null;
  missingCount: number;
  ungradedCount: number;
  snapshots: SnapshotPoint[];
  config: GradingConfig;
  periods: GradingPeriod[];
  assignments: Assignment[];
  colorIndex: number;
  plan: CoursePlan;
}

export interface ConnectionView {
  method: "extension" | "api";
  host: string;
  status: "active" | "expired" | "revoked" | "error";
  accountLabel: string | null;
  consentAt: string;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
}

export interface SyncRunView {
  id: string;
  startedAt: string;
  source: string;
  status: "success" | "error";
  coursesCount: number;
  changesCount: number;
  errorCode: string | null;
}

export interface Workspace {
  displayName: string | null;
  /** Name from the student's Schoology account. */
  fullName: string | null;
  connection: ConnectionView | null;
  courses: CourseView[];
  /** First real snapshot. History before this does not exist and is never shown. */
  trackingSince: string | null;
  syncRuns: SyncRunView[];
  generatedAt: string;
}
