import { describe, expect, it } from "vitest";
import { buildExampleData } from "@/lib/example-data";
import { buildCourseView } from "@/server/data/view";

describe("example dataset", () => {
  const now = new Date("2026-10-08T15:00:00");
  const example = buildExampleData(now);

  it("is deterministic", () => {
    expect(JSON.stringify(buildExampleData(now))).toBe(JSON.stringify(example));
  });

  it("history is derived from the example's own graded work, never ahead of today", () => {
    for (const c of example.courses) {
      const last = c.snapshots.at(-1)!;
      const view = buildCourseView(c.course, c.assignments, c.snapshots, 0);
      expect(last.percent).toBe(view.percent);
      for (const a of c.assignments) if (a.gradedAt) expect(Date.parse(a.gradedAt)).toBeLessThanOrEqual(now.getTime() + 86_400_000);
    }
  });

  it("includes at least one estimated-method course to exercise labelling", () => {
    expect(example.courses.some((c) => c.course.config.methodSource !== "schoology")).toBe(true);
  });
});
