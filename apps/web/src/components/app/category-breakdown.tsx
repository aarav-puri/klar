import type { GradeResult } from "@klar/core";
import { fmtPoints } from "@/lib/format";

export function CategoryBreakdown({ result, method }: { result: GradeResult; method: "total_points" | "weighted_categories" }) {
  if (result.categories.length === 0) {
    return <p className="px-5 pb-5 text-sm text-ink-2">No grading categories in Schoology.</p>;
  }
  const graded = result.categories.filter((c) => c.percent !== null);
  if (graded.length === 0) {
    return <p className="px-5 pb-5 text-sm text-ink-2">Nothing graded yet.</p>;
  }
  return (
    <ul className="space-y-4 px-5 pb-5">
      {graded.map((c) => (
        <li key={c.categoryId}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold">{c.name}</p>
            <p className="tabular shrink-0 text-sm font-bold">{c.percent!.toFixed(1)}%</p>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${Math.min(100, c.percent!)}%` }} />
          </div>
          <p className="tabular mt-1 text-xs text-ink-3">
            {method === "weighted_categories"
              ? c.weight === null
                ? "No weight listed"
                : `Weight ${fmtPoints(c.weight)}%${Math.abs(c.effectiveWeight - c.weight) > 0.05 ? `, counting as ${c.effectiveWeight.toFixed(1)}% for now` : ""}`
              : `${fmtPoints(c.earned)} of ${fmtPoints(c.possible)} points`}
          </p>
        </li>
      ))}
    </ul>
  );
}
