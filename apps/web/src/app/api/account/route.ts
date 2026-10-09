import { NextResponse, type NextRequest } from "next/server";
import { jsonError, requireStudent } from "@/server/api";
import { asStudent } from "@/server/db";
import { getAuth } from "@/server/neon-auth";
import { limiters } from "@/server/rate-limit";

/** Delete everything Klar stores for the student, then their Neon Auth account. */
export async function DELETE(req: NextRequest) {
  const guard = await requireStudent(req, limiters.mutate);
  if (!guard.ok) return guard.response;
  await asStudent(guard.db, guard.userId, (tx) => tx.query(`select public.delete_my_account_data()`));
  // Stored Schoology tokens cascade with the connection above.
  const { error } = await getAuth().deleteUser();
  if (error) return jsonError(500, "AUTH_ERROR", "Your data was deleted, but the login couldn't be removed. Try again.");
  await getAuth().signOut();
  return NextResponse.json({ ok: true });
}
