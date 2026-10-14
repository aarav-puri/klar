import { assignmentImpacts, pointsLost, type GradeResult } from "@klar/core";
import { fmtDelta } from "@/lib/format";
import type { CourseView } from "@/server/data/types";

/**
 * The gap between the grade and 100%, split by category, plus the single
 * scores doing the most damage and the most good.
 */
export function PointsBreakdown({ course, result }: { course: CourseView; result: GradeResult }) {
  if (result.rawPercent === null) return null;
  const losses = pointsLost(result).filter((l) => l.lost > 0.05);
  const impacts = assignmentImpacts(course.assignments, course.config);
  const drags = impacts.filter((i) => i.impact <= -0.1).slice(0, 3);
  const boosts = impacts.filter((i) => i.impact >= 0.1).reverse().slice(0, 2);
  const maxLost = Math.max(...losses.map((l) => l.lost), 0.01);
  if (losses.length === 0 && drags.length === 0) {
    return <p className="border-t border-line px-5 py-4 text-sm text-ink-2">You&rsquo;re at or near full marks everywhere.</p>;
  }

  return (
    <div className="space-y-5 border-t border-line px-5 py-4">
      {losses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-ink-2">Points below 100%, by category</p>
          <ul className="mt-2 space-y-2">
            {losses.map((l) => (
              <li key={l.categoryId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate text-sm font-semibold">{l.name}</span>
                <span className="tabular text-sm font-bold text-danger">−{l.lost.toFixed(1)}</span>
                <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-danger/70" style={{ width: `${(l.lost / maxLost) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
          {losses.length > 1 && (
            <p className="mt-2 text-xs text-ink-2">
              {losses[0]!.name} costs you the most. Raising your {losses[0]!.name.toLowerCase()} average by 10 points adds about{" "}
              {((result.categories.find((c) => c.categoryId === losses[0]!.categoryId)?.effectiveWeight ?? 0) / 10).toFixed(1)} pts to the course grade.
            </p>
          )}
        </div>
      )}

      {(drags.length > 0 || boosts.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-ink-2">Scores moving your grade most</p>
          <ul className="mt-2 space-y-1.5">
            {[...drags, ...boosts].map(({ assignment: a, impact }) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <span className={`tabular shrink-0 text-xs font-bold ${impact < 0 ? "text-danger" : "text-success"}`}>{fmtDelta(impact)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">The grade with each score minus the grade without it.</p>
        </div>
      )}
    </div>
  );
}
