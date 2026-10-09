import { parseSyncPayload, type SyncPayload } from "@klar/core";
import { describe, expect, it } from "vitest";
import { planIngest, stateAfter } from "@/server/ingest-plan";

function payload(earned: (number | null)[], extra: Partial<{ reported: number | null }> = {}): SyncPayload {
  const r = parseSyncPayload({
    source: "extension_page",
    schoologyHost: "lincoln.schoology.com",
    capturedAt: "2026-10-08T12:00:00Z",
    accountLabel: null,
    courses: [
      {
        sourceId: "s1",
        name: "Biology",
        teacher: null,
        sectionName: null,
        reportedPercent: extra.reported ?? null,
        reportedLetter: null,
        method: null,
        periods: [],
        categories: [],
        assignments: earned.map((e, i) => ({
          sourceId: `a${i}`,
          title: `Lab ${i}`,
          categorySourceId: null,
          periodSourceId: null,
          dueAt: null,
          earned: e,
          possible: 10,
          status: e === null ? "ungraded" : "graded",
          late: false,
          extraCredit: false,
          comment: null,
          url: null,
        })),
      },
    ],
  });
  if (!r.ok) throw new Error(r.error);
  return r.payload;
}

const t0 = new Date("2026-10-08T12:00:00Z");
const t1 = new Date("2026-10-08T13:00:00Z");
const t2 = new Date("2026-10-09T12:00:00Z");

describe("ingest planning", () => {
  it("stamps only scores that appear or change after tracking began", () => {
    const first = planIngest(payload([9, null, 7]), null, t0);
    const second = planIngest(payload([9, 8, 10]), stateAfter(first, t0.toISOString()), t1);
    const [unchanged, posted, regraded] = second.courses[0]!.assignments;
    expect(unchanged!.gradedAt).toBeNull();
    expect(posted!.gradedAt).toBe(t1.toISOString());
    expect(regraded!.gradedAt).toBe(t1.toISOString());
    // ...and keeps that stamp on later syncs.
    const third = planIngest(payload([9, 8, 10]), stateAfter(second, t1.toISOString()), t2);
    expect(third.courses[0]!.assignments[1]!.gradedAt).toBe(t1.toISOString());
  });

  it("uses the source's own grading time when it has one", () => {
    const p = payload([9]);
    p.courses[0]!.assignments[0]!.gradedAt = "2026-10-05T15:30:00.000Z";
    expect(planIngest(p, null, t0).courses[0]!.assignments[0]!.gradedAt).toBe("2026-10-05T15:30:00.000Z");
  });

  it("treats a course seen for the first time on a later sync as a baseline", () => {
    const first = planIngest(payload([9]), null, t0);
    const prev = stateAfter(first, t0.toISOString());
    // Pretend the tracked course is a different one; s1 is now new to Klar.
    prev.courses = { other: prev.courses.s1! };
    const plan = planIngest(payload([9]), prev, t1);
    expect(plan.courses[0]!.assignments[0]!.gradedAt).toBeNull();
    // ...and its existing scores aren't reported as changes.
    expect(plan.stats.changes).toBe(0);
  });

  it("first sync records a snapshot and counts no changes", () => {
    const plan = planIngest(payload([9, null]), null, t0);
    expect(plan.courses[0]!.snapshot).toEqual({ percent: 90, letter: "A-" });
    expect(plan.stats.changes).toBe(0);
    // Scores that existed before tracking began have no known posting time.
    expect(plan.courses[0]!.assignments[0]!.gradedAt).toBeNull();
    expect(plan.courses[0]!.assignments[1]!.gradedAt).toBeNull();
  });

  it("is idempotent: replaying the same payload changes nothing", () => {
    const first = planIngest(payload([9, null]), null, t0);
    const replay = planIngest(payload([9, null]), stateAfter(first, t0.toISOString()), t1);
    expect(replay.courses[0]!.snapshot).toBeNull();
    expect(replay.stats.changes).toBe(0);
    // A baseline score stays "unknown" instead of becoming "just graded".
    expect(replay.courses[0]!.assignments[0]!.gradedAt).toBeNull();
  });

  it("detects a newly posted grade exactly once", () => {
    const first = planIngest(payload([9, null]), null, t0);
    const second = planIngest(payload([9, 6]), stateAfter(first, t0.toISOString()), t1);
    expect(second.stats.changes).toBe(1);
    expect(second.courses[0]!.snapshot?.percent).toBe(75);
    expect(second.courses[0]!.assignments[1]!.gradedAt).toBe(t1.toISOString());
    const third = planIngest(payload([9, 6]), stateAfter(second, t1.toISOString()), t1);
    expect(third.stats.changes).toBe(0);
  });

  it("refreshes an unchanged snapshot about once a day so charts have daily points", () => {
    const first = planIngest(payload([9]), null, t0);
    const nextDay = planIngest(payload([9]), stateAfter(first, t0.toISOString()), t2);
    expect(nextDay.courses[0]!.snapshot).toEqual({ percent: 90, letter: "A-" });
  });

  it("prefers the grade Schoology reports over its own calculation", () => {
    const plan = planIngest(payload([9], { reported: 91.5 }), null, t0);
    expect(plan.courses[0]!.currentPercent).toBe(91.5);
  });

  it("marks assignments and courses that disappeared", () => {
    const first = planIngest(payload([9, 8]), null, t0);
    const prev = stateAfter(first, t0.toISOString());
    prev.courses.s2 = { name: "Dropped", percent: 80, assignments: {} };
    const next = planIngest(payload([9]), prev, t1);
    expect(next.courses[0]!.removedAssignmentIds).toEqual(["a1"]);
    expect(next.archivedCourseIds).toEqual(["s2"]);
  });
});
