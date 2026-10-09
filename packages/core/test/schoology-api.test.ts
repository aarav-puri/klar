import { describe, expect, it } from "vitest";
import { mapApiBundle } from "../src/schoology-api";
import { parseSyncPayload } from "../src/sync";

describe("official API mapping", () => {
  it("maps sections, grades, categories and exceptions", () => {
    const payload = mapApiBundle({
      host: "app.schoology.com",
      capturedAt: "2026-10-08T12:00:00Z",
      accountLabel: "Student",
      sections: [{ id: 42, course_title: "Chemistry", section_title: "Period 3", instructors: [{ name_display: "Dr. Okafor" }] }],
      grades: [
        {
          section_id: "42",
          period: [
            {
              period_id: 7,
              period_title: "Q1",
              assignment: [
                { assignment_id: 1, grade: "18", max_points: "20", category_id: 3, timestamp: 1791480000 },
                { assignment_id: 2, grade: null, max_points: 10, category_id: 3, exception: 3 },
                { assignment_id: 3, grade: 0, max_points: 10, category_id: 4, exception: 1 },
              ],
            },
          ],
          final_grade: [{ period_id: 7, grade: "90.5" }],
        },
      ],
      assignmentsBySection: {
        "42": [
          { id: 1, title: "Lab report", due: "2026-10-01 23:59:00", web_url: "https://app.schoology.com/assignment/1" },
          { id: 2, title: "Worksheet" },
          { id: 3, title: "Quiz" },
          { id: 4, title: "Upcoming exam", max_points: 100, grading_category: 4 },
        ],
      },
      categoriesBySection: { "42": [{ id: 3, title: "Labs", weight: 40 }, { id: 4, title: "Exams", weight: 60 }] },
    });
    const r = parseSyncPayload(payload);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = r.payload.courses[0]!;
    expect(c).toMatchObject({ sourceId: "s42", name: "Chemistry", teacher: "Dr. Okafor", method: "weighted_categories", reportedPercent: 90.5 });
    const byTitle = Object.fromEntries(c.assignments.map((a) => [a.title, a]));
    expect(byTitle["Lab report"]).toMatchObject({ earned: 18, possible: 20, status: "graded", periodSourceId: "p7", categorySourceId: "c3" });
    // Schoology's own grading time is kept (unix seconds), so ordering is exact.
    expect(byTitle["Lab report"]!.gradedAt).toBe(new Date(1791480000 * 1000).toISOString());
    expect(byTitle["Upcoming exam"]!.gradedAt).toBeNull();
    expect(byTitle["Worksheet"]!.status).toBe("missing");
    expect(byTitle["Quiz"]!.status).toBe("excused");
    expect(byTitle["Upcoming exam"]).toMatchObject({ earned: null, possible: 100, status: "ungraded", categorySourceId: "c4" });
  });
});
