import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson, requireStudent } from "@/server/api";
import { asStudent } from "@/server/db";
import { planInput, savePlan, type PlanInput } from "@/server/plans";
import { limiters } from "@/server/rate-limit";

/** Save the student's plan for one course: goal and level. */
export async function PUT(req: NextRequest) {
  const guard = await requireStudent(req, limiters.mutate);
  if (!guard.ok) return guard.response;
  let input: PlanInput;
  try {
    input = planInput.parse(await readJson(req, 2_000));
  } catch {
    return jsonError(400, "BAD_REQUEST", "That plan couldn't be saved.");
  }
  const saved = await asStudent(guard.db, guard.userId, (tx) => savePlan(tx, guard.userId, input));
  if (!saved) return jsonError(404, "NOT_FOUND", "That course isn't in your Klar account.");
  return NextResponse.json({ ok: true });
}
