import { z } from "zod";
import type { Tx } from "./db";

export const planInput = z.object({
  courseId: z.uuid(),
  goalPercent: z.number().min(0).max(150).nullable(),
  level: z.enum(["standard", "honors", "ap"]).nullable(),
});

export type PlanInput = z.infer<typeof planInput>;

/**
 * Save the student's plan for one of their courses. Returns false when the
 * course isn't theirs (row-level security would refuse the write anyway).
 */
export async function savePlan(tx: Tx, userId: string, input: PlanInput): Promise<boolean> {
  const owned = await tx.query(`select 1 from public.courses where id = $1 and user_id = $2`, [input.courseId, userId]);
  if (owned.rows.length === 0) return false;
  await tx.query(
    `insert into public.course_plans (course_id, user_id, goal_percent, level, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (course_id) do update
       set goal_percent = excluded.goal_percent, level = excluded.level, updated_at = now()`,
    [input.courseId, userId, input.goalPercent, input.level],
  );
  return true;
}
