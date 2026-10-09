import type { Assignment } from "@klar/core";
import { Badge } from "@/components/ui/badge";

const RECENT_MS = 3 * 86_400_000;

/** Status chips for an assignment. Missing is shown only when the teacher flagged it. */
export function StatusBadges({ a, now }: { a: Assignment; now: Date }) {
  const chips: React.ReactNode[] = [];
  if (a.status === "missing") chips.push(<Badge key="m" tone="danger">Missing</Badge>);
  else if (a.status === "excused") chips.push(<Badge key="e" tone="outline">Excused</Badge>);
  else if (a.status === "incomplete") chips.push(<Badge key="i" tone="warning">Incomplete</Badge>);
  else if (a.status === "ungraded") {
    const past = a.dueAt && Date.parse(a.dueAt) < now.getTime();
    chips.push(<Badge key="u" tone="outline">{past ? "Awaiting grade" : "Not graded"}</Badge>);
  } else if (a.gradedAt && now.getTime() - Date.parse(a.gradedAt) < RECENT_MS) {
    chips.push(<Badge key="n" tone="brand">New</Badge>);
  }
  if (a.late) chips.push(<Badge key="l" tone="warning">Late</Badge>);
  if (a.extraCredit) chips.push(<Badge key="x" tone="brand">Extra credit</Badge>);
  return <span className="inline-flex flex-wrap gap-1">{chips}</span>;
}
