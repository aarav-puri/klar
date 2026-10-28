import { describe, expect, it } from "vitest";
import {
  applyScenario,
  computeGrade,
  defaultConfig,
  DEFAULT_SCALE,
  latestChange,
  letterFor,
  unweightedGpa,
  requiredScore,
  roundTo,
} from "../src/grades";
import { a } from "./helpers";

const weighted = defaultConfig({
  method: "weighted_categories",
  methodSource: "schoology",
  scaleSource: "schoology",
  categories: [
    { id: "tests", name: "Tests", weight: 60 },
    { id: "hw", name: "Homework", weight: 40 },
  ],
});

describe("total points", () => {
  it("sums earned over possible and ignores ungraded work", () => {
    const r = computeGrade([a({ earned: 9, possible: 10 }), a({ earned: 18, possible: 20 }), a({ earned: null, possible: 10 })], defaultConfig());
    expect(r.percent).toBe(90);
    expect(r.gradedCount).toBe(2);
    expect(r.letter).toBe("A");
  });

  it("returns null with no graded work instead of 0", () => {
    const r = computeGrade([a({ earned: null, possible: 10 })], defaultConfig());
    expect(r.percent).toBeNull();
    expect(r.letter).toBeNull();
  });

  it("excludes excused and incomplete items", () => {
    const r = computeGrade(
      [a({ earned: 10, possible: 10 }), a({ earned: 0, possible: 50, status: "excused" }), a({ earned: 0, possible: 50, status: "incomplete" })],
      defaultConfig(),
    );
    expect(r.percent).toBe(100);
  });

  it("does not count missing items without a score unless policy says so", () => {
    const items = [a({ earned: 10, possible: 10 }), a({ earned: null, possible: 10, status: "missing" })];
    const exclude = computeGrade(items, defaultConfig());
    expect(exclude.percent).toBe(100);
    expect(exclude.assumptions.join(" ")).toMatch(/missing item has no score/);
    expect(computeGrade(items, defaultConfig({ missingPolicy: "zero" })).percent).toBe(50);
  });

  it("adds extra credit to the numerator only", () => {
    const r = computeGrade([a({ earned: 9, possible: 10 }), a({ earned: 2, possible: 0, extraCredit: true })], defaultConfig());
    expect(r.percent).toBe(110);
  });

  it("applies rounding rules", () => {
    // 89.995 should round half-up to 90.00
    const r = computeGrade([a({ earned: 89.995, possible: 100 })], defaultConfig({ roundingDecimals: 2 }));
    expect(r.percent).toBe(90);
    expect(r.letter).toBe("A");
    const unrounded = computeGrade([a({ earned: 2, possible: 3 })], defaultConfig({ roundingDecimals: null }));
    expect(unrounded.percent).toBeCloseTo(66.6667, 3);
    expect(unrounded.assumptions.join(" ")).toMatch(/Rounding rule unknown/);
  });

  it("filters by grading period", () => {
    const items = [a({ earned: 10, possible: 10, periodId: "q1" }), a({ earned: 0, possible: 10, periodId: "q2" })];
    expect(computeGrade(items, defaultConfig(), { periodId: "q1" }).percent).toBe(100);
    expect(computeGrade(items, defaultConfig(), { periodId: "q2" }).percent).toBe(0);
    expect(computeGrade(items, defaultConfig()).percent).toBe(50);
  });

  it("labels assumed configuration", () => {
    const r = computeGrade([a({ earned: 1, possible: 1 })], defaultConfig());
    expect(r.assumptions.some((s) => s.includes("assumes total-points"))).toBe(true);
    expect(r.assumptions.some((s) => s.includes("standard scale"))).toBe(true);
  });
});

describe("weighted categories", () => {
  it("weights category percentages", () => {
    const r = computeGrade(
      [
        a({ earned: 80, possible: 100, categoryId: "tests" }),
        a({ earned: 45, possible: 50, categoryId: "hw" }),
      ],
      weighted,
    );
    // 0.6 * 80 + 0.4 * 90
    expect(r.percent).toBe(84);
    expect(r.assumptions).toEqual([]);
    const tests = r.categories.find((c) => c.categoryId === "tests")!;
    expect(tests.percent).toBe(80);
    expect(tests.effectiveWeight).toBe(60);
  });

  it("is not the same as total points for the same scores", () => {
    const items = [a({ earned: 80, possible: 100, categoryId: "tests" }), a({ earned: 45, possible: 50, categoryId: "hw" })];
    expect(computeGrade(items, defaultConfig()).percent).toBeCloseTo(83.33, 2);
    expect(computeGrade(items, weighted).percent).toBe(84);
  });

  it("re-normalizes when a category has no graded work", () => {
    const r = computeGrade([a({ earned: 45, possible: 50, categoryId: "hw" })], weighted);
    expect(r.percent).toBe(90);
    expect(r.categories.find((c) => c.categoryId === "hw")!.effectiveWeight).toBe(100);
    expect(r.categories.find((c) => c.categoryId === "tests")!.percent).toBeNull();
    expect(r.assumptions.join(" ")).toMatch(/scaled up proportionally/);
  });

  it("leaves out uncategorized work and says so", () => {
    const r = computeGrade([a({ earned: 45, possible: 50, categoryId: "hw" }), a({ earned: 0, possible: 100 })], weighted);
    expect(r.percent).toBe(90);
    expect(r.assumptions.join(" ")).toMatch(/not in a weighted category/);
  });

  it("extra credit inside a category raises that category", () => {
    const r = computeGrade(
      [
        a({ earned: 40, possible: 50, categoryId: "hw" }),
        a({ earned: 5, possible: 0, categoryId: "hw", extraCredit: true }),
        a({ earned: 90, possible: 100, categoryId: "tests" }),
      ],
      weighted,
    );
    // hw = 45/50 = 90, tests = 90
    expect(r.percent).toBe(90);
  });
});

describe("what-if", () => {
  const base = [
    a({ id: "t1", earned: 70, possible: 100, categoryId: "tests" }),
    a({ id: "h1", earned: 50, possible: 50, categoryId: "hw" }),
    a({ id: "t2", earned: null, possible: 100, categoryId: "tests" }),
  ];

  it("never mutates the real assignments", () => {
    const copy = structuredClone(base);
    applyScenario(base, { edits: { t1: { earned: 100, possible: 100 } }, hypotheticals: [] }, "c1");
    expect(base).toEqual(copy);
  });

  it("edits an existing score", () => {
    const projected = applyScenario(base, { edits: { t1: { earned: 90, possible: 100 } }, hypotheticals: [] }, "c1");
    expect(computeGrade(base, weighted).percent).toBe(82); // .6*70 + .4*100
    expect(computeGrade(projected, weighted).percent).toBe(94);
  });

  it("scores an ungraded assignment", () => {
    const projected = applyScenario(base, { edits: { t2: { earned: 100, possible: 100 } }, hypotheticals: [] }, "c1");
    expect(computeGrade(projected, weighted).percent).toBe(91); // tests 170/200 = 85 → .6*85 + 40
  });

  it("adds hypothetical future assignments to a category", () => {
    const projected = applyScenario(
      base,
      { edits: {}, hypotheticals: [{ id: "h-x", title: "Final", categoryId: "tests", earned: 100, possible: 200 }] },
      "c1",
    );
    // tests 170/300 = 56.667 → .6*56.667 + 40 = 74
    expect(computeGrade(projected, weighted).percent).toBe(74);
  });

  it("solves for the score needed on an assignment", () => {
    const need = requiredScore(base, weighted, { assignmentId: "t2", possible: 100, targetPercent: 90 })!;
    // tests needs (90-40)/.6 = 83.33% → (70 + x)/200 = .8333 → x = 96.67
    expect(need.needed).toBeCloseTo(96.667, 2);
    expect(need.achievable).toBe(true);
    const impossible = requiredScore(base, weighted, { assignmentId: "t2", possible: 100, targetPercent: 99 })!;
    expect(impossible.achievable).toBe(false);
    const secured = requiredScore(base, weighted, { assignmentId: "t2", possible: 100, targetPercent: 50 })!;
    expect(secured.alreadySecured).toBe(true);
  });

  it("solves for a total-points course", () => {
    const items = [a({ id: "x", earned: 80, possible: 100 }), a({ id: "f", earned: null, possible: 100 })];
    const need = requiredScore(items, defaultConfig(), { assignmentId: "f", possible: 100, targetPercent: 90 })!;
    expect(need.needed).toBeCloseTo(100, 6);
  });
});

describe("letters and helpers", () => {
  it("maps percentages to letters using inclusive minimums", () => {
    expect(letterFor(90, DEFAULT_SCALE)).toBe("A");
    expect(letterFor(85, DEFAULT_SCALE)).toBe("B");
    expect(letterFor(75, DEFAULT_SCALE)).toBe("C");
    expect(letterFor(65, DEFAULT_SCALE)).toBe("D");
    expect(letterFor(0, DEFAULT_SCALE)).toBe("F");
    expect(letterFor(null, DEFAULT_SCALE)).toBeNull();
  });

  it("rounds a grade up to the letter it reaches", () => {
    expect(letterFor(89.5, DEFAULT_SCALE)).toBe("A");
    expect(letterFor(89.49, DEFAULT_SCALE)).toBe("B");
    expect(letterFor(79.5, DEFAULT_SCALE)).toBe("B");
    expect(letterFor(59.5, DEFAULT_SCALE)).toBe("D");
    expect(letterFor(59.4, DEFAULT_SCALE)).toBe("F");
  });

  it("rounds half-up", () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(84.444, 1)).toBe(84.4);
  });

  it("reports change only when real history exists", () => {
    expect(latestChange([])).toBeNull();
    expect(latestChange([{ capturedAt: "2026-10-01", percent: 90 }])).toBeNull();
    expect(latestChange([{ capturedAt: "2026-10-01", percent: 90 }, { capturedAt: "2026-10-02", percent: 90 }])).toBeNull();
    const c = latestChange([
      { capturedAt: "2026-10-01", percent: 88 },
      { capturedAt: "2026-10-03", percent: 91.2 },
      { capturedAt: "2026-10-02", percent: 90 },
      { capturedAt: "2026-10-04", percent: 91.2 },
    ])!;
    expect(c.delta).toBe(1.2);
    expect(c.since).toBe("2026-10-02");
  });

  it("computes an unweighted GPA and skips ungraded courses", () => {
    expect(
      unweightedGpa([
        { percent: 91, letter: "A-" },
        { percent: null, letter: null },
        { percent: 84, letter: "B" },
        { percent: 71, letter: null },
      ]),
    ).toEqual({ gpa: 3, courseCount: 3 });
    expect(unweightedGpa([{ percent: 88, letter: "Proficient" }])).toEqual({ gpa: 3, courseCount: 1 });
    expect(unweightedGpa([{ percent: null, letter: null }])).toEqual({ gpa: null, courseCount: 0 });
  });
});
