"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useToast } from "@/components/app/toast";
import type { CoursePlan } from "@/server/data/types";

/**
 * Course plans with optimistic edits: a change shows at once, is saved to the
 * student's account, and rolls back with a toast if saving fails.
 */
export function usePlans(initial: Record<string, CoursePlan>): [Record<string, CoursePlan>, (courseId: string, patch: Partial<CoursePlan>) => void, boolean] {
  const router = useRouter();
  const toast = useToast();
  const [plans, setPlans] = useState(initial);
  const [pending, setPending] = useState(0);

  const update = useCallback(
    (courseId: string, patch: Partial<CoursePlan>) => {
      const prev = plans[courseId];
      if (!prev) return;
      const next = { ...prev, ...patch };
      setPlans((p) => ({ ...p, [courseId]: next }));
      setPending((n) => n + 1);
      void fetch("/api/plans", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId, ...next }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
          router.refresh();
        })
        .catch(() => {
          setPlans((p) => ({ ...p, [courseId]: prev }));
          toast({ tone: "danger", title: "Couldn't save that", body: "Check your connection and try again." });
        })
        .finally(() => setPending((n) => n - 1));
    },
    [plans, router, toast],
  );

  return [plans, update, pending > 0];
}

/** One course's plan. */
export function useCoursePlan(courseId: string, initial: CoursePlan): [CoursePlan, (patch: Partial<CoursePlan>) => void, boolean] {
  const [plans, update, saving] = usePlans({ [courseId]: initial });
  return [plans[courseId]!, (patch) => update(courseId, patch), saving];
}
