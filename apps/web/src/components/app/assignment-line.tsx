import Link from "next/link";
import { dueLabel, fmtDay, fmtDelta, fmtPoints, relativeTime } from "@/lib/format";
import type { AssignmentRow } from "@/lib/workload";
import { cn } from "@/lib/utils";

/** One assignment in a compact list (overview, assignments, calendar). */
export function AssignmentLine({ row, mode, now }: { row: AssignmentRow; mode: "graded" | "due" | "missing"; now: Date }) {
  return (
    <li>
      <Link href={`/app/courses/${row.courseId}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
          <p className="truncate text-xs text-ink-2">
            {row.courseName}
            {mode === "graded"
              ? row.gradedAt
                ? `, graded ${relativeTime(row.gradedAt, now).toLowerCase()}`
                : row.dueAt
                  ? `, due ${fmtDay(row.dueAt)}`
                  : ""
              : ""}
          </p>
        </div>
        {mode === "graded" ? (
          <div className="shrink-0 text-right">
            <p className="tabular text-sm font-bold">
              {fmtPoints(row.earned)}
              <span className="font-semibold text-ink-3">/{fmtPoints(row.possible)}</span>
            </p>
            {row.percent !== null && (
              <p className={cn("tabular text-xs font-semibold", row.percent >= 90 ? "text-success" : row.percent < 70 ? "text-danger" : "text-ink-2")}>
                {row.percent.toFixed(0)}%
              </p>
            )}
          </div>
        ) : (
          mode === "missing" && row.recovery ? (
            <div className="shrink-0 text-right" title={`A zero would change the grade by ${fmtDelta(row.recovery.ifZero)} pts`}>
              <p className="tabular text-xs font-bold text-success">{fmtDelta(row.recovery.ifFull)} pts if turned in</p>
              <p className="tabular text-2xs font-semibold text-danger">{fmtDelta(row.recovery.ifZero)} if it becomes a zero</p>
            </div>
          ) : (
            <p className={cn("shrink-0 text-xs font-semibold", mode === "missing" ? "text-danger" : "text-ink-2")}>
              {mode === "missing" ? "Missing" : row.dueAt ? dueLabel(row.dueAt, now) : ""}
            </p>
          )
        )}
      </Link>
    </li>
  );
}
