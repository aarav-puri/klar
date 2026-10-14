import {
  computeGrade,
  latestChange,
  letterFor,
  type Assignment,
  type Course,
} from "@klar/core";
import { EMPTY_PLAN, type CoursePlan, type CourseView, type SnapshotPoint } from "./types";

export function buildCourseView(
  course: Course,
  assignments: Assignment[],
  snapshots: SnapshotPoint[],
  colorIndex: number,
  plan: CoursePlan = EMPTY_PLAN,
): CourseView {
  const calc = computeGrade(assignments, course.config);
  const fromSchoology = course.reportedPercent !== null;
  const percent = fromSchoology ? course.reportedPercent : calc.percent;
  return {
    id: course.id,
    name: course.name,
    teacher: course.teacher,
    sectionName: course.sectionName,
    percent,
    letter: course.reportedLetter ?? letterFor(percent, course.config.scale),
    percentSource: fromSchoology ? "schoology" : "calculated",
    calculatedPercent: calc.percent,
    change: latestChange(snapshots),
    missingCount: assignments.filter((a) => a.status === "missing").length,
    ungradedCount: assignments.filter((a) => a.status === "ungraded").length,
    snapshots,
    config: course.config,
    periods: course.periods,
    assignments,
    colorIndex,
    plan,
  };
}
