import { NextResponse, type NextRequest } from "next/server";
import { requireStudent } from "@/server/api";
import { asStudent } from "@/server/db";
import { limiters } from "@/server/rate-limit";

/**
 * Disconnect Schoology: delete the connection. Stored OAuth tokens cascade
 * with it. Synced grades stay until the student deletes them.
 */
export async function POST(req: NextRequest) {
  const guard = await requireStudent(req, limiters.mutate);
  if (!guard.ok) return guard.response;
  await asStudent(guard.db, guard.userId, (tx) => tx.query(`delete from public.schoology_connections where user_id = $1`, [guard.userId]));
  return NextResponse.json({ ok: true });
}
