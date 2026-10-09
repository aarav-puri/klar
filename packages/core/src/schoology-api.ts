/**
 * Maps responses from the official Schoology REST API (v1) into the shared
 * SyncPayload shape. Pure functions only; the authenticated HTTP client lives
 * on the server (apps/web/src/server/schoology).
 *
 * Endpoints consumed:
 *   GET /v1/users/{uid}/sections
 *   GET /v1/users/{uid}/grades
 *   GET /v1/sections/{sid}/assignments
 *   GET /v1/sections/{sid}/grading_categories
 *
 * Every field is read defensively because responses vary by district.
 */

import type { SyncAssignment, SyncCourse, SyncPayloadInput } from "./sync";

export interface ApiSection {
  id: string | number;
  course_title?: string;
  section_title?: string;
  /** Some districts return teacher info when the section is expanded. */
  instructors?: { name_display?: string }[];
}

export interface ApiGradeItem {
  assignment_id: string | number;
  grade?: number | string | null;
  max_points?: number | string | null;
  exception?: number | string | null;
  category_id?: string | number | null;
  timestamp?: number | string | null;
  comment?: string | null;
  is_final?: number | string;
  type?: string;
}

export interface ApiSectionGrades {
  section_id: string | number;
  period?: { period_id: string | number; period_title?: string; assignment?: ApiGradeItem[] }[];
  final_grade?: { period_id: string | number; grade?: number | string | null; weight?: number | string | null }[];
  grading_category?: { id: string | number; title?: string; weight?: number | string | null }[];
}

export interface ApiAssignment {
  id: string | number;
  title?: string;
  due?: string | null;
  max_points?: number | string | null;
  grading_category?: string | number | null;
  grading_period?: string | number | null;
  web_url?: string | null;
  type?: string;
}

export interface ApiCategory {
  id: string | number;
  title?: string;
  weight?: number | string | null;
  calculation_type?: number | string | null;
}

export interface ApiBundle {
  host: string;
  capturedAt: string;
  accountLabel: string | null;
  sections: ApiSection[];
  grades: ApiSectionGrades[];
  assignmentsBySection: Record<string, ApiAssignment[]>;
  categoriesBySection: Record<string, ApiCategory[]>;
}

/** Schoology grade timestamps are unix seconds. */
export function parseApiTimestamp(v: unknown): string | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Schoology returns "2026-10-12 23:59:00" in the school's local zone. */
export function parseApiDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function mapApiBundle(bundle: ApiBundle): SyncPayloadInput {
  const gradesBySection = new Map(bundle.grades.map((g) => [String(g.section_id), g]));
  const courses: SyncCourse[] = [];

  for (const section of bundle.sections) {
    const sid = String(section.id);
    const sg = gradesBySection.get(sid);
    const apiAssignments = bundle.assignmentsBySection[sid] ?? [];
    const apiCategories = bundle.categoriesBySection[sid] ?? sg?.grading_category ?? [];

    const categories = apiCategories.map((c) => ({
      sourceId: `c${c.id}`,
      name: c.title?.trim() || "Category",
      weight: num(c.weight),
    }));
    const weightTotal = categories.reduce((s, c) => s + (c.weight ?? 0), 0);

    const gradeByAssignment = new Map<string, { item: ApiGradeItem; periodId: string }>();
    const periods: SyncCourse["periods"] = [];
    for (const p of sg?.period ?? []) {
      periods.push({ sourceId: `p${p.period_id}`, title: p.period_title?.trim() || "Grading period" });
      for (const item of p.assignment ?? []) {
        gradeByAssignment.set(String(item.assignment_id), { item, periodId: `p${p.period_id}` });
      }
    }

    const assignments: SyncAssignment[] = [];
    const seen = new Set<string>();
    const pushAssignment = (id: string, meta: ApiAssignment | undefined) => {
      if (seen.has(id)) return;
      seen.add(id);
      const g = gradeByAssignment.get(id);
      const exception = num(g?.item.exception);
      const earned = num(g?.item.grade);
      const possible = num(g?.item.max_points) ?? num(meta?.max_points);
      let status: SyncAssignment["status"] = earned === null ? "ungraded" : "graded";
      // Documented: 1 = excused, 2 = incomplete. 3 is used for missing in practice.
      if (exception === 1) status = "excused";
      else if (exception === 2) status = "incomplete";
      else if (exception === 3) status = earned === null ? "missing" : "graded";
      const categoryId = g?.item.category_id ?? meta?.grading_category ?? null;
      assignments.push({
        sourceId: `a${id}`,
        title: meta?.title?.trim() || "Untitled",
        categorySourceId: categoryId !== null && categoryId !== undefined && String(categoryId) !== "0" ? `c${categoryId}` : null,
        periodSourceId: g?.periodId ?? (meta?.grading_period ? `p${meta.grading_period}` : null),
        dueAt: parseApiDate(meta?.due),
        earned,
        possible,
        status,
        late: false,
        extraCredit: possible === 0 && earned !== null,
        comment: g?.item.comment?.trim() || null,
        url: meta?.web_url ?? null,
        gradedAt: earned === null ? null : parseApiTimestamp(g?.item.timestamp),
      });
    };
    for (const a of apiAssignments) pushAssignment(String(a.id), a);
    for (const id of gradeByAssignment.keys()) pushAssignment(id, undefined);

    const finalGrade = sg?.final_grade?.find((f) => num(f.grade) !== null);

    courses.push({
      sourceId: `s${sid}`,
      name: section.course_title?.trim() || "Course",
      teacher: section.instructors?.[0]?.name_display?.trim() || null,
      sectionName: section.section_title?.trim() || null,
      reportedPercent: num(finalGrade?.grade),
      reportedLetter: null,
      method: weightTotal > 0 ? "weighted_categories" : categories.length > 0 ? "total_points" : null,
      periods,
      categories,
      assignments,
    });
  }

  return {
    source: "schoology_api",
    schoologyHost: bundle.host,
    capturedAt: bundle.capturedAt,
    accountLabel: bundle.accountLabel,
    courses,
  };
}
