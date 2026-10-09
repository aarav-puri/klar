import "server-only";
import {
  DEFAULT_SCALE,
  defaultConfig,
  type Assignment,
  type Course,
} from "@klar/core";
import { cache } from "react";
import { asStudent, getDb } from "../db";
import { iso, num } from "../ingest";
import { getViewer } from "../viewer";
import type { ConnectionView, SnapshotPoint, SyncRunView, Workspace } from "./types";
import { buildCourseView } from "./view";

/** Everything the app shell renders for the current viewer, or null when signed out. */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const viewer = await getViewer();
  if (viewer.kind === "user") return liveWorkspace(viewer.userId, viewer.name);
  return null;
});

async function liveWorkspace(userId: string, fullName: string | null): Promise<Workspace> {
  const db = await getDb();
  return asStudent(db, userId, async (tx) => {
    const q = <T,>(sql: string, params: unknown[] = []) => tx.query<T>(sql, params).then((r) => r.rows);

    const [profile] = await q<{ display_name: string | null }>(`select display_name from public.profiles where id = $1`, [userId]);
    const [conn] = await q<{ method: ConnectionView["method"]; status: ConnectionView["status"]; account_label: string | null; consent_at: unknown; last_sync_at: unknown; last_error_code: string | null; schoology_host: string }>(
      `select c.method, c.status, c.account_label, c.consent_at, c.last_sync_at, c.last_error_code, s.schoology_host
         from public.schoology_connections c join public.schools s on s.id = c.school_id where c.user_id = $1`,
      [userId],
    );
    const courses = await q<{
      id: string;
      name: string;
      teacher: string | null;
      section_name: string | null;
      reported_percent: unknown;
      reported_letter: string | null;
      grading_method: "total_points" | "weighted_categories";
      method_source: "schoology" | "inferred" | "assumed";
      rounding_decimals: number | null;
      categories: { source_id: string; name: string; weight: number | null }[];
      periods: { source_id: string; title: string }[];
    }>(
      `select c.id, c.name, c.teacher, c.section_name, c.reported_percent, c.reported_letter, c.grading_method, c.method_source, c.rounding_decimals,
              coalesce((select json_agg(json_build_object('source_id', k.source_id, 'name', k.name, 'weight', k.weight) order by k.source_id) from public.grading_categories k where k.course_id = c.id), '[]') as categories,
              coalesce((select json_agg(json_build_object('source_id', p.source_id, 'title', p.title) order by p.source_id) from public.grading_periods p where p.course_id = c.id), '[]') as periods
         from public.courses c where c.user_id = $1 and c.archived = false order by c.name`,
      [userId],
    );
    const assignments = await q<{
      id: string;
      course_id: string;
      category_source_id: string | null;
      period_source_id: string | null;
      title: string;
      due_at: unknown;
      possible: unknown;
      status: Assignment["status"];
      late: boolean;
      extra_credit: boolean;
      url: string | null;
      earned: unknown;
      grade_possible: unknown;
      comment: string | null;
      graded_at: unknown;
    }>(
      `select a.id, a.course_id, a.category_source_id, a.period_source_id, a.title, a.due_at, a.possible, a.status, a.late, a.extra_credit, a.url,
              g.earned, g.possible as grade_possible, g.comment, g.graded_at
         from public.assignments a left join public.grades g on g.assignment_id = a.id
        where a.user_id = $1 and a.removed_at is null order by a.due_at nulls last, a.title`,
      [userId],
    );
    const snapshots = await q<{ course_id: string; captured_at: unknown; percent: unknown }>(
      `select course_id, captured_at, percent from public.grade_snapshots where user_id = $1 and captured_at > now() - interval '400 days' order by captured_at`,
      [userId],
    );
    const runs = await q<{ id: string; started_at: unknown; source: string; status: "success" | "error"; courses_count: number; changes_count: number; error_code: string | null }>(
      `select id, started_at, source, status, courses_count, changes_count, error_code from public.sync_runs where user_id = $1 order by started_at desc limit 12`,
      [userId],
    );

    const snapsByCourse = new Map<string, SnapshotPoint[]>();
    for (const s of snapshots) {
      const list = snapsByCourse.get(s.course_id) ?? [];
      list.push({ capturedAt: iso(s.captured_at)!, percent: num(s.percent) });
      snapsByCourse.set(s.course_id, list);
    }
    const byCourse = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = byCourse.get(a.course_id) ?? [];
      list.push({
        id: a.id,
        courseId: a.course_id,
        categoryId: a.category_source_id,
        periodId: a.period_source_id,
        title: a.title,
        dueAt: iso(a.due_at),
        earned: num(a.earned),
        possible: num(a.grade_possible ?? a.possible),
        status: a.status,
        late: a.late,
        extraCredit: a.extra_credit,
        gradedAt: iso(a.graded_at),
        comment: a.comment,
        url: a.url,
      });
      byCourse.set(a.course_id, list);
    }

    const courseViews = courses.map((r, i) => {
      const course: Course = {
        id: r.id,
        name: r.name,
        teacher: r.teacher,
        sectionName: r.section_name,
        reportedPercent: num(r.reported_percent),
        reportedLetter: r.reported_letter,
        config: defaultConfig({
          method: r.grading_method,
          methodSource: r.method_source,
          roundingDecimals: r.rounding_decimals,
          scale: DEFAULT_SCALE,
          scaleSource: "assumed",
          categories: r.categories.map((c) => ({ id: c.source_id, name: c.name, weight: num(c.weight) })),
        }),
        periods: r.periods.map((p) => ({ id: p.source_id, title: p.title })),
      };
      return buildCourseView(course, byCourse.get(r.id) ?? [], snapsByCourse.get(r.id) ?? [], i);
    });

    return {
      displayName: profile?.display_name ?? null,
      fullName,
      connection: conn
        ? {
            method: conn.method,
            host: conn.schoology_host,
            status: conn.status,
            accountLabel: conn.account_label,
            consentAt: iso(conn.consent_at)!,
            lastSyncAt: iso(conn.last_sync_at),
            lastErrorCode: conn.last_error_code,
          }
        : null,
      courses: courseViews,
      trackingSince: snapshots[0] ? iso(snapshots[0].captured_at) : null,
      syncRuns: runs.map((r) => ({
        id: r.id,
        startedAt: iso(r.started_at)!,
        source: r.source,
        status: r.status,
        coursesCount: r.courses_count,
        changesCount: r.changes_count,
        errorCode: r.error_code,
      })) satisfies SyncRunView[],
      generatedAt: new Date().toISOString(),
    } satisfies Workspace;
  });
}
