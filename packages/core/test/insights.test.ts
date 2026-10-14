import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE, defaultConfig } from "../src/grades";
import {
  assignmentImpacts,
  assignmentSwing,
  detectLevel,
  explainChange,
  goalPath,
  letterPosition,
  missingRecovery,
  pointsLost,
  weightedGpa,
} from "../src/insights";
import { computeGrade } from "../src/grades";
import { a } from "./helpers";

// Tests 60%, Homework 40%. Graded: 80/100 test, 9/10 homework, so 0.6 * 80 + 0.4 * 90 = 84.
const config = defaultConfig({
  method: "weighted_categories",
  methodSource: "schoology",
  categories: [
    { id: "tests", name: "Tests", weight: 60 },
    { id: "hw", name: "Homework", weight: 40 },
  ],
});
const t1 = a({ id: "t1", categoryId: "tests", earned: 80, possible: 100, gradedAt: "2026-10-01T12:00:00Z" });
const h1 = a({ id: "h1", categoryId: "hw", earned: 9, possible: 10, gradedAt: "2026-10-05T12:00:00Z" });
const t2 = a({ id: "t2", categoryId: "tests", earned: null, possible: 100 });
const course = [t1, h1, t2];

describe("stakes", () => {
  it("measures how far one unscored assignment can move the grade", () => {
    const s = assignmentSwing(course, config, "t2")!;
    // Zero: tests 80/200 = 40%, so 24 + 36 = 60. Full: tests 180/200 = 90%, so 54 + 36 = 90.
    expect(s.atZero).toBeCloseTo(60);
    expect(s.atFull).toBeCloseTo(90);
    expect(s.swing).toBeCloseTo(30);
  });

  it("returns null for an assignment without points", () => {
    expect(assignmentSwing([...course, a({ id: "x", earned: null, possible: null })], config, "x")).toBeNull();
  });

  it("prices missing work against the grade as it stands", () => {
    const m = a({ id: "m1", categoryId: "hw", earned: null, possible: 10, status: "missing" });
    const r = missingRecovery([...course, m], config, "m1")!;
    // Turned in for full credit: homework 19/20 = 95%, so 48 + 38 = 86. A zero: 9/20 = 45%, so 48 + 18 = 66.
    expect(r.ifFull).toBeCloseTo(2);
    expect(r.ifZero).toBeCloseTo(-18);
    expect(missingRecovery(course, config, "t2")).toBeNull();
  });
});

describe("explaining the grade", () => {
  it("splits the gap to 100 across categories", () => {
    const lost = pointsLost(computeGrade(course, config));
    expect(lost.map((l) => l.name)).toEqual(["Tests", "Homework"]);
    expect(lost[0]!.lost).toBeCloseTo(12);
    expect(lost[1]!.lost).toBeCloseTo(4);
    expect(lost.reduce((s, l) => s + l.lost, 0)).toBeCloseTo(100 - 84);
  });

  it("measures each score's effect by leaving it out", () => {
    const impacts = assignmentImpacts(course, config);
    // Without the test the grade is homework alone (90); without homework it's the test alone (80).
    expect(impacts.map((i) => [i.assignment.id, Number(i.impact.toFixed(6))])).toEqual([
      ["t1", -6],
      ["h1", 4],
    ]);
  });

  it("traces a change to the scores posted since", () => {
    const e = explainChange(course, config, "2026-10-03T00:00:00Z");
    expect(e.before).toBeCloseTo(80);
    expect(e.after).toBeCloseTo(84);
    expect(e.steps.map((s) => s.assignment.id)).toEqual(["h1"]);
    expect(e.steps[0]!.delta).toBeCloseTo(4);
  });

  it("replays several scores in posting order and leaves the first one blank when there was no grade before", () => {
    const e = explainChange(course, config, "2026-09-01T00:00:00Z");
    expect(e.before).toBeNull();
    expect(e.steps.map((s) => s.assignment.id)).toEqual(["t1", "h1"]);
    expect(e.steps[0]!.delta).toBeNull();
    expect(e.steps[1]!.delta).toBeCloseTo(4);
  });

  it("finds nothing when no score was posted after the moment", () => {
    expect(explainChange(course, config, "2026-10-10T00:00:00Z").steps).toEqual([]);
  });
});

describe("goals", () => {
  it("solves for the average needed on everything left", () => {
    const g = goalPath(course, config, 90)!;
    expect(g.neededAverage).toBeCloseTo(100);
    expect(g.achievable).toBe(true);
    expect(g.remainingCount).toBe(1);
    expect(g.remainingPoints).toBe(100);
    // 84% on the last test: tests 164/200 = 82%, so 49.2 + 36 = 85.2.
    expect(g.atCurrentPace).toBeCloseTo(85.2);
  });

  it("knows when a goal is out of reach or already secured", () => {
    expect(goalPath(course, config, 95)!.achievable).toBe(false);
    expect(goalPath(course, config, 95)!.best).toBeCloseTo(90);
    expect(goalPath(course, config, 50)!.alreadySecured).toBe(true);
  });

  it("can't plan without remaining posted work", () => {
    expect(goalPath([t1, h1], config, 90)).toBeNull();
  });

  it("matches the target exactly when the needed average is applied", () => {
    const both = [...course, a({ id: "h2", categoryId: "hw", earned: null, possible: 20 })];
    const g = goalPath(both, config, 88)!;
    const f = g.neededAverage / 100;
    const graded = both.map((x) => (x.id === "t2" || x.id === "h2" ? { ...x, earned: f * x.possible!, status: "graded" as const } : x));
    expect(computeGrade(graded, config).rawPercent).toBeCloseTo(88);
  });

  it("places a grade between letters", () => {
    expect(letterPosition(84, DEFAULT_SCALE)).toEqual({ letter: "B", cushion: 1, next: { letter: "B+", min: 87, gap: 3 } });
    expect(letterPosition(98, DEFAULT_SCALE)!.next).toBeNull();
    expect(letterPosition(50, DEFAULT_SCALE)).toEqual({ letter: "F", cushion: null, next: { letter: "D-", min: 60, gap: 10 } });
    expect(letterPosition(null, DEFAULT_SCALE)).toBeNull();
  });
});

describe("GPA", () => {
  it("detects course levels from names", () => {
    expect(detectLevel("AP Calculus BC")).toBe("ap");
    expect(detectLevel("IB History HL")).toBe("ap");
    expect(detectLevel("Honors Chemistry")).toBe("honors");
    expect(detectLevel("English 10 (H)")).toBe("honors");
    expect(detectLevel("Biology")).toBe("standard");
    expect(detectLevel("Chapter Studies")).toBe("standard");
  });

  it("adds level bonuses, but never to a failing grade", () => {
    const r = weightedGpa([
      { percent: 95, letter: "A", level: "ap" },
      { percent: 85, letter: null, level: "standard" },
      { percent: 40, letter: "F", level: "honors" },
      { percent: null, letter: null, level: "ap" },
    ]);
    expect(r).toEqual({ gpa: 2.67, courseCount: 3 });
  });
});
