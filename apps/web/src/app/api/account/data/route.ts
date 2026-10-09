import { NextResponse, type NextRequest } from "next/server";
import { requireStudent } from "@/server/api";
import { asStudent } from "@/server/db";
import { limiters } from "@/server/rate-limit";

/** Delete every synced record (courses, grades, history, connection and tokens). */
export async function DELETE(req: NextRequest) {
  const guard = await requireStudent(req, limiters.mutate);
  if (!guard.ok) return guard.response;
  await asStudent(guard.db, guard.userId, (tx) => tx.query(`select public.delete_my_grade_data()`));
  return NextResponse.json({ ok: true });
}
