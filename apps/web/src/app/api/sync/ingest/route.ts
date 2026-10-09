import { parseSyncPayload } from "@klar/core";
import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, requireStudent } from "@/server/api";
import { IngestError, ingestPayload, recordSyncError } from "@/server/ingest";
import { limiters } from "@/server/rate-limit";

const MAX_BYTES = 2_000_000;

/**
 * Receives grade data the student's own browser extension read from their
 * Schoology gradebook. Body: { payload, connect?: { consent: true } }.
 */
export async function POST(req: NextRequest) {
  const guard = await requireStudent(req, limiters.ingest);
  if (!guard.ok) return guard.response;

  let body: { payload?: unknown; connect?: { consent?: unknown } };
  try {
    body = (await readJson(req, MAX_BYTES)) as typeof body;
  } catch (e) {
    return e instanceof Error && e.message === "too_large"
      ? jsonError(413, "TOO_LARGE", "That gradebook is larger than Klar supports.")
      : jsonError(400, "BAD_JSON", "Malformed request.");
  }

  const parsed = parseSyncPayload(body?.payload);
  if (!parsed.ok) return jsonError(422, "INVALID_PAYLOAD", `The grade data was not in the expected format (${parsed.error}).`);
  if (parsed.payload.courses.length === 0) return jsonError(422, "NO_COURSES", "No courses with grades were found.");

  const connect = body.connect ? body.connect.consent === true : false;
  if (body.connect && !connect) return jsonError(400, "CONSENT_REQUIRED", "Consent is required to connect.");

  try {
    const result = await ingestPayload(guard.db, guard.userId, parsed.payload, {
      connect: connect ? { method: "extension", consentAt: new Date().toISOString() } : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof IngestError) {
      await recordSyncError(guard.db, guard.userId, parsed.payload.source, e.code).catch(() => undefined);
      const status = e.code === "DB_ERROR" ? 500 : 409;
      // Never echo database internals to the client.
      return jsonError(status, e.code, e.code === "DB_ERROR" ? "Klar couldn't save this sync. Try again." : e.message);
    }
    console.error("[ingest] unexpected", e instanceof Error ? e.message : e);
    return jsonError(500, "INTERNAL", "Klar couldn't save this sync. Try again.");
  }
}
