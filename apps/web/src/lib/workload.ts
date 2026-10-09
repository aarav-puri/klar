import type { Assignment } from "@klar/core";
import type { CourseView } from "@/server/data/types";

export interface AssignmentRow extends Assignment {
  courseName: string;
  courseId: string;
  categoryName: string | null;
  percent: number | null;
  colorIndex: number;
}

export function flattenAssignments(courses: CourseView[]): AssignmentRow[] {
  return courses.flatMap((c) => {
    const cats = new Map(c.config.categories.map((k) => [k.id, k.name]));
    return c.assignments.map((a) => ({
      ...a,
      courseName: c.name,
      courseId: c.id,
      colorIndex: c.colorIndex,
      categoryName: a.categoryId ? (cats.get(a.categoryId) ?? null) : null,
      percent: a.earned !== null && a.possible ? (a.earned / a.possible) * 100 : null,
    }));
  });
}

const DAY = 86_400_000;

/** Ungraded work due from now through `days` ahead. Excused items are skipped. */
export function upcoming(rows: AssignmentRow[], now: Date, days = 7): AssignmentRow[] {
  const end = now.getTime() + days * DAY;
  return rows
    .filter((r) => r.dueAt && r.status === "ungraded" && Date.parse(r.dueAt) >= now.getTime() - 3_600_000 && Date.parse(r.dueAt) <= end)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
}

/**
 * Only items the teacher flagged as missing. A past due date alone is never
 * treated as missing: work may be submitted and simply not graded yet.
 */
export function missing(rows: AssignmentRow[]): AssignmentRow[] {
  return rows.filter((r) => r.status === "missing").sort((a, b) => (b.dueAt ?? "").localeCompare(a.dueAt ?? ""));
}

/** Past due, no score, not flagged. Shown as "awaiting grade", not "missing". */
export function awaitingGrade(rows: AssignmentRow[], now: Date): AssignmentRow[] {
  return rows.filter((r) => r.status === "ungraded" && r.dueAt && Date.parse(r.dueAt) < now.getTime());
}

/**
 * Graded work, most recent first: known posting time (newest first), then due
 * date (newest first) for scores whose posting time is unknown.
 */
export function byMostRecentScore(rows: AssignmentRow[]): AssignmentRow[] {
  const t = (iso: string | null) => (iso ? Date.parse(iso) : -Infinity);
  return rows
    .filter((r) => r.earned !== null)
    .sort((a, b) => t(b.gradedAt) - t(a.gradedAt) || t(b.dueAt) - t(a.dueAt) || a.title.localeCompare(b.title));
}

export function needsAttention(courses: CourseView[]): { course: CourseView; reason: string }[] {
  const out: { course: CourseView; reason: string }[] = [];
  for (const c of courses) {
    const reasons: string[] = [];
    if (c.missingCount > 0) reasons.push(`${c.missingCount} missing assignment${c.missingCount === 1 ? "" : "s"}`);
    if (c.change && c.change.delta <= -1) reasons.push(`down ${Math.abs(c.change.delta).toFixed(1)} points`);
    if (reasons.length) out.push({ course: c, reason: reasons.join(", ") });
  }
  return out.sort((a, b) => b.course.missingCount - a.course.missingCount);
}
