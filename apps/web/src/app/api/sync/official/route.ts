import { parseSyncPayload } from "@klar/core";
import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireStudent } from "@/server/api";
import { unseal } from "@/server/crypto";
import { asStudent } from "@/server/db";
import { officialApiConfigured } from "@/server/env";
import { ingestPayload, recordSyncError } from "@/server/ingest";
import { limiters } from "@/server/rate-limit";
import { fetchBundle, SchoologyApiError } from "@/server/schoology/client";

/** Server-side sync through the official Schoology API (if connected that way). */
export async function POST(req: NextRequest) {
  if (!officialApiConfigured) return jsonError(501, "NOT_CONFIGURED", "The official Schoology API isn't set up on this server.");
  const guard = await requireStudent(req, limiters.officialSync);
  if (!guard.ok) return guard.response;
  const { db, userId } = guard;

  const conn = (
    await db.query<{ id: string; method: string; schoology_user_id: string | null; account_label: string | null; schoology_host: string; token_ciphertext: string | null; secret_ciphertext: string | null }>(
      `select c.id, c.method, c.schoology_user_id, c.account_label, s.schoology_host, t.token_ciphertext, t.secret_ciphertext
         from public.schoology_connections c
         join public.schools s on s.id = c.school_id
         left join private.schoology_tokens t on t.connection_id = c.id and t.user_id = c.user_id
        where c.user_id = $1`,
      [userId],
    )
  ).rows[0];
  if (!conn || conn.method !== "api" || !conn.schoology_user_id) return jsonError(409, "NOT_CONNECTED", "Connect through the Schoology API first.");
  const token = conn.token_ciphertext ? unseal(conn.token_ciphertext) : null;
  const secret = conn.secret_ciphertext ? unseal(conn.secret_ciphertext) : null;
  if (!token || !secret) return jsonError(409, "EXPIRED", "Your Schoology authorization is missing. Reconnect to continue.");

  try {
    const raw = await fetchBundle(conn.schoology_host, conn.schoology_user_id, { token, secret }, conn.account_label);
    const parsed = parseSyncPayload(raw);
    if (!parsed.ok) return jsonError(502, "BAD_RESPONSE", "Schoology returned data Klar couldn't read.");
    return NextResponse.json(await ingestPayload(db, userId, parsed.payload));
  } catch (e) {
    if (e instanceof SchoologyApiError) {
      if (e.code === "UNAUTHORIZED") {
        await asStudent(db, userId, (tx) => tx.query(`update public.schoology_connections set status = 'expired' where user_id = $1`, [userId]));
      }
      await recordSyncError(db, userId, "schoology_api", e.code).catch(() => undefined);
      return jsonError(e.code === "UNAUTHORIZED" ? 409 : 502, e.code === "UNAUTHORIZED" ? "EXPIRED" : e.code, e.message);
    }
    console.error("[official-sync] unexpected", e instanceof Error ? e.message : e);
    return jsonError(500, "INTERNAL", "Sync failed. Try again.");
  }
}
