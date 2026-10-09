import type { Assignment } from "../src/types";

let n = 0;
export function a(partial: Partial<Assignment> & Pick<Assignment, "earned" | "possible">): Assignment {
  n++;
  return {
    id: partial.id ?? `a${n}`,
    courseId: "c1",
    categoryId: null,
    periodId: null,
    title: `Assignment ${n}`,
    dueAt: null,
    status: partial.earned === null ? "ungraded" : "graded",
    late: false,
    extraCredit: false,
    gradedAt: null,
    comment: null,
    url: null,
    ...partial,
  };
}
