/**
 * Pure planning step for a sync. Given what we stored last time and the new
 * payload, decide exactly which rows to write, which snapshots to record,
 * and what changed. No I/O here, so it is fully unit tested.
 */
import {
  courseFromSync,
  effectivePercent,
  letterFor,
  type SyncPayload,
  type AssignmentStatus,
} from "@klar/core";

export interface PrevAssignment {
  title: string;
  earned: number | null;
  possible: number | null;
  status: AssignmentStatus;
  dueAt: string | null;
  gradedAt: string | null;
}

export interface PrevCourse {
  name: string;
  percent: number | null;
  assignments: Record<string, PrevAssignment>;
}

export interface PrevState {
  courses: Record<string, PrevCourse>;
  lastSnapshot: Record<string, { percent: number | null; capturedAt: string }>;
}

export interface PlannedAssignment {
  sourceId: string;
  title: string;
  categorySourceId: string | null;
  periodSourceId: string | null;
  dueAt: string | null;
  possible: number | null;
  status: string;
  late: boolean;
  extraCredit: boolean;
  url: string | null;
  earned: number | null;
  gradePossible: number | null;
  comment: string | null;
  gradedAt: string | null;
}

export interface PlannedCourse {
  sourceId: string;
  name: string;
  teacher: string | null;
  sectionName: string | null;
  reportedPercent: number | null;
  reportedLetter: string | null;
  currentPercent: number | null;
  currentLetter: string | null;
  gradingMethod: "total_points" | "weighted_categories";
  methodSource: "schoology" | "inferred" | "assumed";
  categories: { sourceId: string; name: string; weight: number | null }[];
  periods: { sourceId: string; title: string }[];
  assignments: PlannedAssignment[];
  /** Assignments we had before that Schoology no longer lists. */
  removedAssignmentIds: string[];
  snapshot: { percent: number | null; letter: string | null } | null;
}

export interface IngestPlan {
  courses: PlannedCourse[];
  archivedCourseIds: string[];
  stats: { courses: number; assignments: number; changes: number };
}

/**
 * When a score was posted. The gradebook page doesn't say, so:
 *  - a timestamp from the source (official API) always wins;
 *  - a score that appears or changes after the course was already being
 *    tracked was posted since the last sync, so it gets "now";
 *  - scores present the first time Klar sees a course are a baseline whose
 *    posting time is unknown (null), rather than all pretending to be new.
 */
export function gradedAtFor(
  earned: number | null,
  sourceGradedAt: string | null,
  old: PrevAssignment | undefined,
  scoreChanged: boolean,
  courseTracked: boolean,
  nowIso: string,
): string | null {
  if (earned === null) return null;
  if (sourceGradedAt) return sourceGradedAt;
  if (old && !scoreChanged) return old.gradedAt;
  return courseTracked ? nowIso : null;
}

/** Record a snapshot when the grade moved, or at most once per ~day otherwise. */
export const SNAPSHOT_REFRESH_MS = 20 * 3_600_000;

export function planIngest(
  payload: SyncPayload,
  prev: PrevState | null,
  now: Date,
): IngestPlan {
  const nowIso = now.toISOString();
  const courses: PlannedCourse[] = [];
  let changes = 0;
  let assignmentCount = 0;

  for (const sc of payload.courses) {
    const { course, assignments } = courseFromSync(sc);
    const current = effectivePercent(course, assignments);
    const before = prev?.courses[sc.sourceId];

    const planned: PlannedAssignment[] = sc.assignments.map((a) => {
      const old = before?.assignments[a.sourceId];
      const scoreChanged = !old || old.earned !== a.earned || old.possible !== a.possible;
      // A change is a score that appeared or moved in a course Klar was already
      // tracking. Scores in a course seen for the first time are a baseline.
      if (old && scoreChanged && a.earned !== null) changes++;
      if (!old && a.earned !== null && before) changes++;
      return {
        sourceId: a.sourceId,
        title: a.title,
        categorySourceId: a.categorySourceId,
        periodSourceId: a.periodSourceId,
        dueAt: a.dueAt,
        possible: a.possible,
        status: a.status,
        late: a.late,
        extraCredit: a.extraCredit,
        url: a.url,
        earned: a.earned,
        gradePossible: a.possible,
        comment: a.comment,
        gradedAt: gradedAtFor(a.earned, a.gradedAt ?? null, old, scoreChanged, Boolean(before), nowIso),
      };
    });
    assignmentCount += planned.length;

    const seen = new Set(sc.assignments.map((a) => a.sourceId));
    const removedAssignmentIds = before ? Object.keys(before.assignments).filter((id) => !seen.has(id)) : [];

    const last = prev?.lastSnapshot[sc.sourceId];
    const moved = !last || (last.percent ?? -1) !== (current ?? -1);
    const stale = !last || now.getTime() - Date.parse(last.capturedAt) >= SNAPSHOT_REFRESH_MS;

    courses.push({
      sourceId: sc.sourceId,
      name: sc.name,
      teacher: sc.teacher,
      sectionName: sc.sectionName,
      reportedPercent: sc.reportedPercent,
      reportedLetter: sc.reportedLetter,
      currentPercent: current,
      currentLetter: sc.reportedLetter ?? letterFor(current, course.config.scale),
      gradingMethod: course.config.method,
      methodSource: course.config.methodSource,
      categories: sc.categories.map((c) => ({ sourceId: c.sourceId, name: c.name, weight: c.weight })),
      periods: sc.periods,
      assignments: planned,
      removedAssignmentIds,
      snapshot: moved || stale ? { percent: current, letter: sc.reportedLetter ?? letterFor(current, course.config.scale) } : null,
    });
  }

  const seenCourses = new Set(payload.courses.map((c) => c.sourceId));

  return {
    courses,
    archivedCourseIds: prev ? Object.keys(prev.courses).filter((id) => !seenCourses.has(id)) : [],
    stats: { courses: courses.length, assignments: assignmentCount, changes },
  };
}

/** Rebuild the "previous state" a plan implies, as the database would after applying it. */
export function stateAfter(plan: IngestPlan, nowIso: string): PrevState {
  const courses: PrevState["courses"] = {};
  const lastSnapshot: PrevState["lastSnapshot"] = {};
  for (const c of plan.courses) {
    courses[c.sourceId] = {
      name: c.name,
      percent: c.currentPercent,
      assignments: Object.fromEntries(
        c.assignments.map((a) => [
          a.sourceId,
          { title: a.title, earned: a.earned, possible: a.gradePossible, status: a.status as PrevAssignment["status"], dueAt: a.dueAt, gradedAt: a.gradedAt },
        ]),
      ),
    };
    if (c.snapshot) lastSnapshot[c.sourceId] = { percent: c.snapshot.percent, capturedAt: nowIso };
  }
  return { courses, lastSnapshot };
}

