import type { SyncPayload } from "@klar/core";
import { asStudent, type Db, type Tx } from "./db";
import { planIngest, type PrevState } from "./ingest-plan";

export class IngestError extends Error {
  constructor(
    public code: "HOST_MISMATCH" | "NOT_CONNECTED" | "DB_ERROR",
    message: string,
  ) {
    super(message);
  }
}

export interface IngestResult {
  syncRunId: string;
  courses: number;
  assignments: number;
  changes: number;
  syncedAt: string;
}


/** Postgres drivers return numerics as strings and timestamps as Dates; normalize both. */
export const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
export const iso = (v: unknown): string | null => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

async function loadPrevState(tx: Tx, userId: string): Promise<{ prev: PrevState | null; ids: Map<string, string> }> {
  const rows = (
    await tx.query<{
      id: string;
      source_id: string;
      name: string;
      current_percent: unknown;
      assignments: { source_id: string; title: string; due_at: string | null; possible: number | null; status: string; earned: number | null; gpossible: number | null; graded_at: string | null }[];
    }>(
      `select c.id, c.source_id, c.name, c.current_percent,
              coalesce(json_agg(json_build_object(
                'source_id', a.source_id, 'title', a.title, 'due_at', a.due_at, 'possible', a.possible, 'status', a.status,
                'earned', g.earned, 'gpossible', g.possible, 'graded_at', g.graded_at
              )) filter (where a.id is not null), '[]') as assignments
         from public.courses c
         left join public.assignments a on a.course_id = c.id and a.removed_at is null
         left join public.grades g on g.assignment_id = a.id
        where c.user_id = $1 and c.archived = false
        group by c.id`,
      [userId],
    )
  ).rows;

  const ids = new Map(rows.map((r) => [r.source_id, r.id]));
  if (rows.length === 0) return { prev: null, ids };

  const snaps = (
    await tx.query<{ source_id: string; percent: unknown; captured_at: unknown }>(
      `select distinct on (s.course_id) c.source_id, s.percent, s.captured_at
         from public.grade_snapshots s join public.courses c on c.id = s.course_id
        where s.user_id = $1
        order by s.course_id, s.captured_at desc`,
      [userId],
    )
  ).rows;

  const prev: PrevState = { courses: {}, lastSnapshot: {} };
  for (const s of snaps) prev.lastSnapshot[s.source_id] = { percent: num(s.percent), capturedAt: iso(s.captured_at)! };
  for (const r of rows) {
    prev.courses[r.source_id] = {
      name: r.name,
      percent: num(r.current_percent),
      assignments: Object.fromEntries(
        r.assignments.map((a) => [
          a.source_id,
          {
            title: a.title,
            earned: num(a.earned),
            possible: num(a.gpossible ?? a.possible),
            status: a.status as PrevState["courses"][string]["assignments"][string]["status"],
            dueAt: iso(a.due_at),
            gradedAt: iso(a.graded_at),
          },
        ]),
      ),
    };
  }
  return { prev, ids };
}

/**
 * Apply a validated payload for one student in a single transaction, as that
 * student (row-level security enforced). Every write is an upsert on a
 * natural key, so a retried sync converges on the same state.
 */
export async function ingestPayload(
  db: Db,
  userId: string,
  payload: SyncPayload,
  opts: { connect?: { method: "extension" | "api"; consentAt: string }; now?: Date } = {},
): Promise<IngestResult> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();

  return asStudent(db, userId, async (tx) => {
    await tx.query(`insert into public.schools (schoology_host) values ($1) on conflict (schoology_host) do nothing`, [payload.schoologyHost]);
    const schoolId = (await tx.query<{ id: string }>(`select id from public.schools where schoology_host = $1`, [payload.schoologyHost])).rows[0]!.id;
    const existing = (await tx.query<{ school_id: string; method: string }>(`select school_id, method from public.schoology_connections where user_id = $1`, [userId])).rows[0];

    if (!opts.connect) {
      if (!existing) throw new IngestError("NOT_CONNECTED", "Connect Schoology before syncing.");
      if (existing.school_id !== schoolId) {
        throw new IngestError("HOST_MISMATCH", "This data came from a different school site than the one you connected.");
      }
    } else if (existing && existing.school_id !== schoolId) {
      if (existing.method === "api") {
        // The student signed in with this school's Schoology; the extension must match it.
        throw new IngestError("HOST_MISMATCH", "The extension is connected to a different school site than the one you signed in with.");
      }
      // Switching schools: start fresh so data from two schools never mixes.
      await tx.query(`select public.delete_my_grade_data()`);
    }

    const { prev, ids: courseIds } = await loadPrevState(tx, userId);
    const plan = planIngest(payload, prev, now);

    if (opts.connect) {
      await tx.query(
        `insert into public.schoology_connections (user_id, school_id, method, status, account_label, consent_at, last_sync_at, updated_at)
         values ($1, $2, $3, 'active', $4, $5, $6, $6)
         on conflict (user_id) do update set school_id = excluded.school_id,
           -- Adding the extension to a Schoology sign-in keeps API syncing.
           method = case when public.schoology_connections.method = 'api' then 'api' else excluded.method end,
           status = 'active', account_label = coalesce(public.schoology_connections.account_label, excluded.account_label),
           consent_at = excluded.consent_at, last_sync_at = excluded.last_sync_at,
           last_error_code = null, updated_at = excluded.updated_at`,
        [userId, schoolId, opts.connect.method, payload.accountLabel, opts.connect.consentAt, nowIso],
      );
    } else {
      await tx.query(
        `update public.schoology_connections set status = 'active', account_label = coalesce($2, account_label), last_sync_at = $3, last_error_code = null, updated_at = $3 where user_id = $1`,
        [userId, payload.accountLabel, nowIso],
      );
    }

    const runId = (
      await tx.query<{ id: string }>(
        `insert into public.sync_runs (user_id, source, status, started_at, courses_count, assignments_count, changes_count)
         values ($1, $2, 'success', $3, $4, $5, $6) returning id`,
        [userId, payload.source, nowIso, plan.stats.courses, plan.stats.assignments, plan.stats.changes],
      )
    ).rows[0]!.id;

    if (plan.courses.length) {
      const saved = await tx.query<{ id: string; source_id: string }>(
        `insert into public.courses (user_id, source_id, name, teacher, section_name, reported_percent, reported_letter, current_percent, grading_method, method_source, archived, first_seen_at, last_seen_at)
         select $1, x.source_id, x.name, x.teacher, x.section_name, x.reported_percent, x.reported_letter, x.current_percent, x.grading_method, x.method_source, false, $2, $2
           from jsonb_to_recordset($3::jsonb) as x(source_id text, name text, teacher text, section_name text, reported_percent numeric, reported_letter text, current_percent numeric, grading_method text, method_source text)
         on conflict (user_id, source_id) do update set name = excluded.name, teacher = excluded.teacher, section_name = excluded.section_name,
           reported_percent = excluded.reported_percent, reported_letter = excluded.reported_letter, current_percent = excluded.current_percent,
           grading_method = excluded.grading_method, method_source = excluded.method_source, archived = false, last_seen_at = excluded.last_seen_at
         returning id, source_id`,
        [
          userId,
          nowIso,
          JSON.stringify(
            plan.courses.map((c) => ({
              source_id: c.sourceId,
              name: c.name,
              teacher: c.teacher,
              section_name: c.sectionName,
              reported_percent: c.reportedPercent,
              reported_letter: c.reportedLetter,
              current_percent: c.currentPercent,
              grading_method: c.gradingMethod,
              method_source: c.methodSource,
            })),
          ),
        ],
      );
      for (const s of saved.rows) courseIds.set(s.source_id, s.id);
    }

    for (const c of plan.courses) {
      const courseId = courseIds.get(c.sourceId)!;
      if (c.categories.length) {
        await tx.query(
          `insert into public.grading_categories (user_id, course_id, source_id, name, weight)
           select $1, $2, x.source_id, x.name, x.weight from jsonb_to_recordset($3::jsonb) as x(source_id text, name text, weight numeric)
           on conflict (course_id, source_id) do update set name = excluded.name, weight = excluded.weight`,
          [userId, courseId, JSON.stringify(c.categories.map((x) => ({ source_id: x.sourceId, name: x.name, weight: x.weight })))],
        );
      }
      // Drop categories Schoology no longer reports (for example, per-period
      // duplicates stored before they were merged). Assignments keep their rows;
      // their category is updated by the upsert below.
      await tx.query(
        `delete from public.grading_categories where course_id = $1 and source_id not in (select jsonb_array_elements_text($2::jsonb))`,
        [courseId, JSON.stringify(c.categories.map((x) => x.sourceId))],
      );
      if (c.periods.length) {
        await tx.query(
          `insert into public.grading_periods (user_id, course_id, source_id, title)
           select $1, $2, x.source_id, x.title from jsonb_to_recordset($3::jsonb) as x(source_id text, title text)
           on conflict (course_id, source_id) do update set title = excluded.title`,
          [userId, courseId, JSON.stringify(c.periods.map((x) => ({ source_id: x.sourceId, title: x.title })))],
        );
      }
      if (c.assignments.length) {
        const rows = JSON.stringify(
          c.assignments.map((a) => ({
            source_id: a.sourceId,
            category_source_id: a.categorySourceId,
            period_source_id: a.periodSourceId,
            title: a.title,
            due_at: a.dueAt,
            possible: a.possible,
            status: a.status,
            late: a.late,
            extra_credit: a.extraCredit,
            url: a.url,
            earned: a.earned,
            grade_possible: a.gradePossible,
            comment: a.comment,
            graded_at: a.gradedAt,
          })),
        );
        await tx.query(
          `insert into public.assignments (user_id, course_id, source_id, category_source_id, period_source_id, title, due_at, possible, status, late, extra_credit, url, first_seen_at, last_seen_at, removed_at)
           select $1, $2, x.source_id, x.category_source_id, x.period_source_id, x.title, x.due_at, x.possible, x.status, x.late, x.extra_credit, x.url, $3, $3, null
             from jsonb_to_recordset($4::jsonb) as x(source_id text, category_source_id text, period_source_id text, title text, due_at timestamptz, possible numeric, status text, late boolean, extra_credit boolean, url text)
           on conflict (course_id, source_id) do update set category_source_id = excluded.category_source_id, period_source_id = excluded.period_source_id,
             title = excluded.title, due_at = excluded.due_at, possible = excluded.possible, status = excluded.status, late = excluded.late,
             extra_credit = excluded.extra_credit, url = excluded.url, last_seen_at = excluded.last_seen_at, removed_at = null`,
          [userId, courseId, nowIso, rows],
        );
        await tx.query(
          `insert into public.grades (assignment_id, user_id, earned, possible, comment, graded_at, updated_at)
           select a.id, $1, x.earned, x.grade_possible, x.comment, x.graded_at, $3
             from jsonb_to_recordset($4::jsonb) as x(source_id text, earned numeric, grade_possible numeric, comment text, graded_at timestamptz)
             join public.assignments a on a.course_id = $2 and a.source_id = x.source_id
           on conflict (assignment_id) do update set earned = excluded.earned, possible = excluded.possible, comment = excluded.comment,
             graded_at = excluded.graded_at, updated_at = excluded.updated_at`,
          [userId, courseId, nowIso, rows],
        );
      }
      if (c.removedAssignmentIds.length) {
        await tx.query(
          `update public.assignments set removed_at = $1 where course_id = $2 and source_id in (select jsonb_array_elements_text($3::jsonb))`,
          [nowIso, courseId, JSON.stringify(c.removedAssignmentIds)],
        );
      }
      if (c.snapshot) {
        await tx.query(
          `insert into public.grade_snapshots (user_id, course_id, sync_run_id, captured_at, percent, letter) values ($1, $2, $3, $4, $5, $6)
           on conflict (course_id, captured_at) do nothing`,
          [userId, courseId, runId, nowIso, c.snapshot.percent, c.snapshot.letter],
        );
      }
    }

    if (plan.archivedCourseIds.length) {
      await tx.query(`update public.courses set archived = true where user_id = $1 and source_id in (select jsonb_array_elements_text($2::jsonb))`, [
        userId,
        JSON.stringify(plan.archivedCourseIds),
      ]);
    }

    await tx.query(`update public.sync_runs set finished_at = $2 where id = $1`, [runId, new Date().toISOString()]);

    return {
      syncRunId: runId,
      courses: plan.stats.courses,
      assignments: plan.stats.assignments,
      changes: plan.stats.changes,
      syncedAt: nowIso,
    };
  });
}

export async function recordSyncError(db: Db, userId: string, source: SyncPayload["source"], code: string) {
  const at = new Date().toISOString();
  await asStudent(db, userId, async (tx) => {
    await tx.query(`insert into public.sync_runs (user_id, source, status, started_at, finished_at, error_code) values ($1, $2, 'error', $3, $3, $4)`, [userId, source, at, code]);
    await tx.query(`update public.schoology_connections set last_error_code = $2, last_error_at = $3 where user_id = $1`, [userId, code, at]);
  });
}
