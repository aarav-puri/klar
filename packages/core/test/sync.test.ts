import { describe, expect, it } from "vitest";
import { parseSyncPayload, sanitizeSchoologyUrl } from "../src/sync";

const payload = (over: Record<string, unknown> = {}) => ({
  source: "extension_page",
  schoologyHost: "lincoln.schoology.com",
  capturedAt: "2026-10-08T12:00:00.000Z",
  accountLabel: null,
  courses: [
    {
      sourceId: "s1",
      name: "  AP   Biology\u0000 ",
      teacher: null,
      sectionName: null,
      reportedPercent: 91.2,
      reportedLetter: "A-",
      method: null,
      periods: [],
      categories: [],
      assignments: [
        {
          sourceId: "a1",
          title: "Lab 1",
          categorySourceId: null,
          periodSourceId: null,
          dueAt: null,
          earned: 9,
          possible: 10,
          status: "graded",
          late: false,
          extraCredit: false,
          comment: null,
          url: "javascript:alert(1)",
        },
        {
          sourceId: "a2",
          title: "Lab 2",
          categorySourceId: null,
          periodSourceId: null,
          dueAt: null,
          earned: null,
          possible: 10,
          status: "ungraded",
          late: false,
          extraCredit: false,
          comment: null,
          url: "/assignment/123",
        },
      ],
    },
  ],
  ...over,
});

describe("payload validation", () => {
  it("cleans text and drops unsafe links", () => {
    const r = parseSyncPayload(payload());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.payload.courses[0]!;
    expect(c.name).toBe("AP Biology");
    expect(c.assignments[0]!.url).toBeNull();
    expect(c.assignments[1]!.url).toBe("https://lincoln.schoology.com/assignment/123");
  });
  it("rejects invalid hosts and oversized input", () => {
    expect(parseSyncPayload(payload({ schoologyHost: "evil host" })).ok).toBe(false);
    expect(parseSyncPayload(payload({ courses: Array.from({ length: 41 }, () => payload().courses[0]) })).ok).toBe(false);
    expect(parseSyncPayload({ ...payload(), source: "scraper" }).ok).toBe(false);
  });
  it("keeps links only on the student's host", () => {
    expect(sanitizeSchoologyUrl("https://evil.com/x", "a.schoology.com")).toBeNull();
    expect(sanitizeSchoologyUrl("https://a.schoology.com/x", "a.schoology.com")).toBe("https://a.schoology.com/x");
  });
});
