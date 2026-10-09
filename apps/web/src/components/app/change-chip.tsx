import type { Change } from "@klar/core";
import { fmtDay, fmtDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Percentage-point change since the previous different value. Never invented. */
export function ChangeChip({ change, className }: { change: Change | null; className?: string }) {
  if (!change) return null;
  const up = change.delta > 0;
  return (
    <span
      className={cn("tabular inline-flex items-center gap-1 text-xs font-bold", up ? "text-success" : "text-danger", className)}
      title={`${change.from.toFixed(2)}% on ${fmtDay(change.since)} to ${change.to.toFixed(2)}% now`}
    >
      <svg viewBox="0 0 10 10" className={cn("size-2.5", !up && "rotate-180")} aria-hidden>
        <path d="M5 1.5 9 7.5H1z" fill="currentColor" />
      </svg>
      {fmtDelta(change.delta)} pts
      <span className="sr-only">{up ? "up" : "down"} since {fmtDay(change.since)}</span>
    </span>
  );
}
