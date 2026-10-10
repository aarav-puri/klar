/**
 * Runs the real migration in an in-memory PGlite database and checks
 * row-level security, uniqueness, deletion, accounts and the full ingest
 * pipeline end to end.
 */
import { parseSyncPayload, type SyncPayload } from "@klar/core";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { memoryDb, asStudent } = await import("@/server/db");
const { ingestPayload, IngestError } = await import("@/server/ingest");

type Db = Awaited<ReturnType<typeof memoryDb>>["db"];
let db: Db;
// Neon Auth user ids are opaque text.
const A = "neon-user-a";
const B = "neon-user-b";

/** What viewer.ensureAccount does the first time a Neon Auth user signs in. */
async function bootstrap(user: string, name: string) {
  await asStudent(db, user, async (tx) => {
    await tx.query(`insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [user, name]);
    await tx.query(`insert into public.user_settings (user_id) values ($1) on conflict (user_id) do nothing`, [user]);
  });
}

beforeAll(async () => {
  db = (await memoryDb()).db;
  await bootstrap(A, "Avery");
  await bootstrap(B, "Blake");
}, 30_000);

const as = <T,>(user: string, sql: string, params: unknown[] = []) => asStudent(db, user, (tx) => tx.query<T>(sql, params));

describe("account bootstrap", () => {
  it("creates one profile and settings row per student, idempotently", async () => {
    await bootstrap(A, "Avery");
    const r = await db.query(`select (select count(*)::int from public.profiles) p, (select count(*)::int from public.user_settings) s`);
    expect(r.rows[0]).toEqual({ p: 2, s: 2 });
  });

  it("refuses to create a profile for someone else", async () => {
    await expect(asStudent(db, A, (tx) => tx.query(`insert into public.profiles (id) values ('someone-else')`))).rejects.toThrow(/row-level security/);
  });
});

describe("row-level security", () => {
  it("lets a student read and write only their own rows", async () => {
    const courseA = (await as<{ id: string }>(A, `insert into public.courses (user_id, source_id, name) values ($1, 'rls', 'Biology') returning id`, [A])).rows[0]!.id;
    await as(B, `insert into public.courses (user_id, source_id, name) values ($1, 'rls', 'Biology') returning id`, [B]);
    expect((await as(A, `select id from public.courses where source_id = 'rls'`)).rows).toEqual([{ id: courseA }]);
    expect((await as(B, `select id from public.courses where id = $1`, [courseA])).rows).toEqual([]);
    // Even an update aimed directly at another student's row touches nothing.
    expect((await as(B, `update public.courses set name = 'Hacked' where id = $1`, [courseA])).affectedRows).toBe(0);
  });

  it("refuses rows written for someone else", async () => {
    await expect(as(A, `insert into public.courses (user_id, source_id, name) values ($1, 'x', 'Sneaky')`, [B])).rejects.toThrow(/row-level security/);
  });

  it("refuses children attached to another student's course", async () => {
    const courseB = (await db.query<{ id: string }>(`select id from public.courses where user_id = $1 and source_id = 'rls'`, [B])).rows[0]!.id;
    await expect(as(A, `insert into public.assignments (user_id, course_id, source_id, title, status) values ($1, $2, 'a1', 'X', 'graded')`, [A, courseB])).rejects.toThrow(/row-level security/);
  });

  it("keeps stored Schoology tokens out of a student's reach", async () => {
    await expect(as(A, `select * from private.schoology_tokens`)).rejects.toThrow(/permission denied/);
  });

  it("rejects non-https assignment links", async () => {
    const courseA = (await db.query<{ id: string }>(`select id from public.courses where user_id = $1 and source_id = 'rls'`, [A])).rows[0]!.id;
    await expect(
      as(A, `insert into public.assignments (user_id, course_id, source_id, title, status, url) values ($1, $2, 'a9', 'X', 'graded', 'javascript:alert(1)')`, [A, courseA]),
    ).rejects.toThrow(/check constraint/);
  });
});

function payload(scores: (number | null)[], host = "lincoln.schoology.com"): SyncPayload {
  const r = parseSyncPayload({
    source: "extension_page",
    schoologyHost: host,
    capturedAt: "2026-10-08T12:00:00Z",
    accountLabel: "Sam",
    courses: [
      {
        sourceId: "s7001",
        name: "AP Calculus BC",
        teacher: null,
        sectionName: "Section 2",
        reportedPercent: null,
        reportedLetter: null,
        method: "weighted_categories",
        periods: [{ sourceId: "p1", title: "Semester 1" }],
        categories: [
          { sourceId: "c1", name: "Tests", weight: 60 },
          { sourceId: "c2", name: "Homework", weight: 40 },
        ],
        assignments: scores.map((earned, i) => ({
          sourceId: `a${i}`,
          title: `Item ${i}`,
          categorySourceId: i === 0 ? "c1" : "c2",
          periodSourceId: "p1",
          dueAt: "2026-10-01T23:59:00Z",
          earned,
          possible: i === 0 ? 50 : 10,
          status: earned === null ? "ungraded" : "graded",
          late: false,
          extraCredit: false,
          comment: null,
          url: `https://${host}/assignment/${i}`,
        })),
      },
    ],
  });
  if (!r.ok) throw new Error(r.error);
  return r.payload;
}

describe("ingest pipeline", () => {
  const t0 = new Date("2026-10-08T12:00:00Z");
  const t1 = new Date("2026-10-08T13:00:00Z");

  it("refuses to sync before connecting", async () => {
    await expect(ingestPayload(db, A, payload([45, 9]), { now: t0 })).rejects.toBeInstanceOf(IngestError);
  });

  it("connects and stores everything", async () => {
    const r = await ingestPayload(db, A, payload([45, 9, null]), { connect: { method: "extension", consentAt: t0.toISOString() }, now: t0 });
    expect(r).toMatchObject({ courses: 1, assignments: 3, changes: 0 });
    const course = (await as<{ current_percent: string; grading_method: string }>(A, `select current_percent, grading_method from public.courses where source_id = 's7001'`)).rows[0]!;
    // 0.6 * 90 + 0.4 * 90
    expect(Number(course.current_percent)).toBe(90);
    expect(course.grading_method).toBe("weighted_categories");
    expect((await as(A, `select count(*)::int n from public.grade_snapshots`)).rows).toEqual([{ n: 1 }]);
    expect((await as(A, `select status from public.schoology_connections`)).rows).toEqual([{ status: "active" }]);
    // Scores that existed before tracking began have no invented posting time.
    expect((await as(A, `select count(*)::int n from public.grades where graded_at is not null`)).rows).toEqual([{ n: 0 }]);
  });

  it("is idempotent when the same data arrives again", async () => {
    const r = await ingestPayload(db, A, payload([45, 9, null]), { now: t1 });
    expect(r).toMatchObject({ changes: 0 });
    expect((await as(A, `select count(*)::int n from public.assignments`)).rows).toEqual([{ n: 3 }]);
    expect((await as(A, `select count(*)::int n from public.grade_snapshots`)).rows).toEqual([{ n: 1 }]);
  });

  it("records a newly posted grade once", async () => {
    const r = await ingestPayload(db, A, payload([45, 9, 5]), { now: new Date("2026-10-08T14:00:00Z") });
    expect(r.changes).toBe(1);
    const posted = (await as<{ source_id: string; graded_at: Date }>(A, `select a.source_id, g.graded_at from public.grades g join public.assignments a on a.id = g.assignment_id where g.graded_at is not null`)).rows;
    expect(posted.map((p) => [p.source_id, p.graded_at.toISOString()])).toEqual([["a2", "2026-10-08T14:00:00.000Z"]]);
    const again = await ingestPayload(db, A, payload([45, 9, 5]), { now: new Date("2026-10-08T15:00:00Z") });
    expect(again.changes).toBe(0);
  });

  it("refuses data from a different school than the one connected", async () => {
    await expect(ingestPayload(db, A, payload([45], "other.schoology.com"))).rejects.toMatchObject({ code: "HOST_MISMATCH" });
  });

  it("marks assignments that disappear instead of deleting history", async () => {
    await ingestPayload(db, A, payload([45, 9]), { now: new Date("2026-10-08T16:00:00Z") });
    const removed = (await as<{ source_id: string }>(A, `select source_id from public.assignments where removed_at is not null`)).rows;
    expect(removed).toEqual([{ source_id: "a2" }]);
  });

  it("removes categories Schoology no longer reports (e.g. old per-period duplicates)", async () => {
    // A stale duplicate stored by an earlier sync.
    const courseId = (await as<{ id: string }>(A, `select id from public.courses where source_id = 's7001'`)).rows[0]!.id;
    await as(A, `insert into public.grading_categories (user_id, course_id, source_id, name, weight) values ($1, $2, 'c99', 'Tests', 60)`, [A, courseId]);
    await ingestPayload(db, A, payload([45, 9]), { now: new Date("2026-10-08T17:00:00Z") });
    const cats = (await as<{ source_id: string }>(A, `select source_id from public.grading_categories where course_id = $1 order by source_id`, [courseId])).rows.map((r) => r.source_id);
    expect(cats).toEqual(["c1", "c2"]);
  });

  it("never lets one student's sync touch another student's data", async () => {
    const before = (await db.query(`select count(*)::int n from public.courses where user_id = $1`, [B])).rows;
    await ingestPayload(db, B, payload([10]), { connect: { method: "extension", consentAt: t0.toISOString() }, now: t0 });
    expect((await as(A, `select count(*)::int n from public.courses where source_id = 's7001'`)).rows).toEqual([{ n: 1 }]);
    expect((await db.query(`select count(*)::int n from public.courses where user_id = $1`, [B])).rows).not.toEqual(before);
  });
});

describe("Ask Klar daily limit", () => {
  const take = async (user: string) => (await as<{ ok: boolean }>(user, `select klar.take_assistant_message(5) as ok`)).rows[0]!.ok;

  it("allows five messages a day per student, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await take(A));
    expect(results).toEqual([true, true, true, true, true, false, false]);
    expect(await take(B)).toBe(true);
  });

  it("keeps the counts out of the student's reach", async () => {
    await expect(as(A, `select * from private.assistant_usage`)).rejects.toThrow();
    await expect(as(A, `delete from private.assistant_usage`)).rejects.toThrow();
  });
});

describe("deletion", () => {
  it("deletes one student's grade data without touching anyone else's", async () => {
    await as(A, `select public.delete_my_grade_data()`);
    expect((await db.query(`select count(*)::int n from public.courses where user_id = $1`, [A])).rows).toEqual([{ n: 0 }]);
    expect((await db.query<{ n: number }>(`select count(*)::int n from public.courses where user_id = $1`, [B])).rows[0]!.n).toBeGreaterThan(0);
  });

  it("removes everything Klar stores when the account is deleted", async () => {
    await as(B, `select public.delete_my_account_data()`);
    const r = await db.query(
      `select (select count(*)::int from public.courses where user_id = $1) c, (select count(*)::int from public.profiles where id = $1) p, (select count(*)::int from public.user_settings where user_id = $1) s, (select count(*)::int from private.assistant_usage where user_id = $1) u`,
      [B],
    );
    expect(r.rows[0]).toEqual({ c: 0, p: 0, s: 0, u: 0 });
  });
});
