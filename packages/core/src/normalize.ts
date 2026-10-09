import { computeGrade, defaultConfig } from "./grades";
import type { SyncCourse } from "./sync";
import type { Assignment, Course, GradingConfig } from "./types";

/** Build the grading configuration a synced course implies. */
export function configFromSync(course: SyncCourse): GradingConfig {
  const categories = course.categories.map((c) => ({ id: c.sourceId, name: c.name, weight: c.weight }));
  if (course.method === "weighted_categories") {
    return defaultConfig({ method: "weighted_categories", methodSource: "schoology", categories });
  }
  if (course.method === "total_points") {
    return defaultConfig({ method: "total_points", methodSource: "schoology", categories });
  }
  return defaultConfig({ method: "total_points", methodSource: "assumed", categories });
}

export function courseFromSync(course: SyncCourse): { course: Course; assignments: Assignment[] } {
  const config = configFromSync(course);
  const assignments: Assignment[] = course.assignments.map((a) => ({
    id: a.sourceId,
    courseId: course.sourceId,
    categoryId: a.categorySourceId,
    periodId: a.periodSourceId,
    title: a.title,
    dueAt: a.dueAt,
    earned: a.earned,
    possible: a.possible,
    status: a.status,
    late: a.late,
    extraCredit: a.extraCredit,
    gradedAt: null,
    comment: a.comment,
    url: a.url,
  }));
  return {
    course: {
      id: course.sourceId,
      name: course.name,
      teacher: course.teacher,
      sectionName: course.sectionName,
      reportedPercent: course.reportedPercent,
      reportedLetter: course.reportedLetter,
      config,
      periods: course.periods.map((p) => ({ id: p.sourceId, title: p.title })),
    },
    assignments,
  };
}

/**
 * The percentage we record for a course: Schoology's own number when it is
 * shown (it is authoritative), otherwise our calculation.
 */
export function effectivePercent(course: Course, assignments: Assignment[]): number | null {
  if (course.reportedPercent !== null) return course.reportedPercent;
  return computeGrade(assignments, course.config).percent;
}
