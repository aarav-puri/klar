import { describe, expect, it } from "vitest";
import { awaitingGrade, byMostRecentScore, missing, upcoming, type AssignmentRow } from "./workload";

const row = (p: Partial<AssignmentRow>): AssignmentRow => ({
  id: Math.random().toString(36),
  courseId: "c",
  courseName: "C",
  categoryId: null,
  categoryName: null,
  periodId: null,
  title: "t",
  dueAt: null,
  earned: null,
  possible: 10,
  status: "ungraded",
  late: false,
  extraCredit: false,
  gradedAt: null,
  comment: null,
  url: null,
  percent: null,
  colorIndex: 0,
  ...p,
});

describe("workload", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  it("never treats a past due date as missing", () => {
    const past = row({ dueAt: "2026-10-01T12:00:00Z" });
    expect(missing([past])).toEqual([]);
    expect(awaitingGrade([past], now)).toEqual([past]);
  });
  it("lists only teacher-flagged missing work as missing", () => {
    const flagged = row({ status: "missing", dueAt: "2026-10-01T12:00:00Z" });
    expect(missing([flagged])).toEqual([flagged]);
  });
  it("orders scores by posting time, newest first, then by due date", () => {
    const oldPost = row({ title: "old post", earned: 9, status: "graded", gradedAt: "2026-10-02T12:00:00Z", dueAt: "2026-10-01T12:00:00Z" });
    const newPost = row({ title: "new post", earned: 9, status: "graded", gradedAt: "2026-10-07T12:00:00Z", dueAt: "2026-09-20T12:00:00Z" });
    const baselineRecent = row({ title: "baseline recent", earned: 9, status: "graded", dueAt: "2026-10-06T12:00:00Z" });
    const baselineOld = row({ title: "baseline old", earned: 9, status: "graded", dueAt: "2026-09-01T12:00:00Z" });
    const ungraded = row({ title: "ungraded", dueAt: "2026-10-07T12:00:00Z" });
    expect(byMostRecentScore([baselineOld, oldPost, ungraded, baselineRecent, newPost]).map((r) => r.title)).toEqual([
      "new post",
      "old post",
      "baseline recent",
      "baseline old",
    ]);
  });

  it("finds upcoming ungraded work within the window", () => {
    const soon = row({ dueAt: "2026-10-10T12:00:00Z" });
    const later = row({ dueAt: "2026-11-10T12:00:00Z" });
    const done = row({ dueAt: "2026-10-09T12:00:00Z", status: "graded", earned: 9 });
    expect(upcoming([later, soon, done], now)).toEqual([soon]);
  });
});
