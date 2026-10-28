import { defaultConfig, type Assignment } from "@klar/core";
import { describe, expect, it } from "vitest";
import { buildCourseView } from "@/server/data/view";
import { focusQueue, goalStatus } from "./insights";
import { flattenAssignments } from "./workload";

const now = new Date("2026-10-14T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString();

const a = (o: Partial<Assignment> & Pick<Assignment, "id">): Assignment => ({
  courseId: "c",
  categoryId: null,
  periodId: null,
  title: o.id,
  dueAt: null,
  earned: null,
  possible: null,
  status: "ungraded",
  late: false,
  extraCredit: false,
  gradedAt: null,
  comment: null,
  url: null,
  ...o,
});

const config = defaultConfig({
  method: "weighted_categories",
  methodSource: "schoology",
  categories: [
    { id: "tests", name: "Tests", weight: 70 },
    { id: "hw", name: "Homework", weight: 30 },
  ],
});

const course = (id: string, assignments: Assignment[], plan = { goalPercent: null as number | null, level: null }, reported: number | null = null) =>
  buildCourseView(
    { id, name: id, teacher: null, sectionName: null, reportedPercent: reported, reportedLetter: null, config, periods: [] },
    assignments.map((x) => ({ ...x, courseId: id })),
    [],
    0,
    plan,
  );

// Tests 90/100, homework 20/20: 0.7 * 90 + 0.3 * 100 = 93.
const graded = [a({ id: "t1", categoryId: "tests", earned: 90, possible: 100, status: "graded" }), a({ id: "h1", categoryId: "hw", earned: 20, possible: 20, status: "graded" })];

describe("focus queue", () => {
  const calc = course("calc", [
    ...graded,
    a({ id: "big-test", categoryId: "tests", possible: 100, dueAt: inDays(5) }),
    a({ id: "worksheet", categoryId: "hw", possible: 2, dueAt: inDays(1) }),
    a({ id: "far-off", categoryId: "tests", possible: 100, dueAt: inDays(30) }),
  ]);
  const items = focusQueue(flattenAssignments([calc]), [calc], now);

  it("puts a big test next week ahead of a tiny worksheet due tomorrow, and skips work weeks away", () => {
    expect(items.map((i) => i.row.id)).toEqual(["big-test", "worksheet"]);
  });

  it("says what score keeps the current letter", () => {
    const keep = items[0]!.keep!;
    expect(keep.letter).toBe("A");
    // An A holds down to 89.5, which rounds to 90. That needs tests at (89.5 - 30) / 0.7 = 85%,
    // so 170 of 200 test points: 80 on this one.
    expect(keep.needed).toBeCloseTo(80, 1);
    expect(keep.achievable).toBe(true);
  });
});

describe("goal status", () => {
  const upcoming = a({ id: "next", categoryId: "tests", possible: 100, dueAt: inDays(7) });

  it("is null without a goal", () => {
    expect(goalStatus(course("x", [...graded, upcoming]))).toBeNull();
  });

  it("is on track when the current average gets there", () => {
    expect(goalStatus(course("x", [...graded, upcoming], { goalPercent: 90, level: null }))!.tone).toBe("success");
  });

  it("names the needed average when the student has to pick it up", () => {
    const s = goalStatus(course("x", [...graded, upcoming], { goalPercent: 95, level: null }))!;
    expect(s.label).toMatch(/^Need \d+% avg$/);
  });

  it("is honest when posted work can't get there", () => {
    expect(goalStatus(course("x", [...graded, upcoming], { goalPercent: 99, level: null }))!.tone).toBe("danger");
  });
});
