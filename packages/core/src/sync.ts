import { z } from "zod";
import { normalizeSchoologyHost } from "./protocol";
import type { AssignmentStatus } from "./types";

/**
 * The wire format for one synchronization. Both the extension's page reader
 * and the official API mapper emit this. The server treats it as untrusted
 * input: every field is bounded, and text is stripped of control characters.
 */

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e]", "g");

const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

const sourceId = z.string().regex(/^[A-Za-z0-9:_.-]{1,80}$/);
const points = z.number().finite().min(-10_000).max(100_000);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

export const STATUSES = ["graded", "missing", "excused", "incomplete", "ungraded"] as const satisfies readonly AssignmentStatus[];

export const syncAssignmentSchema = z.object({
  sourceId,
  title: cleanText(300),
  categorySourceId: sourceId.nullable(),
  periodSourceId: sourceId.nullable(),
  dueAt: isoDate.nullable(),
  earned: points.nullable(),
  possible: points.nullable(),
  status: z.enum(STATUSES),
  late: z.boolean(),
  extraCredit: z.boolean(),
  comment: cleanText(2000).nullable(),
  url: z.string().max(2000).nullable(),
  /** When the score was entered, if the source says (the official API does; the gradebook page doesn't). */
  gradedAt: isoDate.nullable().optional(),
});

export const syncCourseSchema = z.object({
  sourceId,
  name: cleanText(200),
  teacher: cleanText(120).nullable(),
  sectionName: cleanText(200).nullable(),
  reportedPercent: z.number().finite().min(-1000).max(1000).nullable(),
  reportedLetter: cleanText(8).nullable(),
  /** Null when the source did not reveal the calculation method. */
  method: z.enum(["total_points", "weighted_categories"]).nullable(),
  periods: z.array(z.object({ sourceId, title: cleanText(120) })).max(20),
  categories: z
    .array(z.object({ sourceId, name: cleanText(120), weight: z.number().finite().min(0).max(1000).nullable() }))
    .max(50),
  assignments: z.array(syncAssignmentSchema).max(1500),
});

export const syncPayloadSchema = z.object({
  source: z.enum(["extension_page", "schoology_api"]),
  schoologyHost: z.string().transform((h, ctx) => {
    const n = normalizeSchoologyHost(h);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Invalid Schoology host" });
      return z.NEVER;
    }
    return n;
  }),
  capturedAt: isoDate,
  accountLabel: cleanText(120).nullable(),
  courses: z.array(syncCourseSchema).max(40),
});

export type SyncAssignment = z.infer<typeof syncAssignmentSchema>;
export type SyncCourse = z.infer<typeof syncCourseSchema>;
export type SyncPayload = z.infer<typeof syncPayloadSchema>;
export type SyncPayloadInput = z.input<typeof syncPayloadSchema>;

/**
 * Only keep links that point back at the student's own Schoology host. Any
 * other URL (javascript:, other domains) is dropped.
 */
export function sanitizeSchoologyUrl(url: string | null, host: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, `https://${host}`);
    if (u.protocol !== "https:" || u.hostname !== host) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function parseSyncPayload(input: unknown):
  | { ok: true; payload: SyncPayload }
  | { ok: false; error: string } {
  const result = syncPayloadSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid payload" };
  }
  const payload = result.data;
  for (const course of payload.courses) {
    for (const a of course.assignments) a.url = sanitizeSchoologyUrl(a.url, payload.schoologyHost);
  }
  return { ok: true, payload };
}
