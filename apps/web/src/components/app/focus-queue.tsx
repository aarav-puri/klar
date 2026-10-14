import { Info } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { seriesColor } from "@/lib/chart-colors";
import { dueLabel, fmtPoints } from "@/lib/format";
import { highStakesThreshold, type FocusItem } from "@/lib/insights";

/**
 * Upcoming work ordered by what it can do to a grade. The bar is the swing:
 * the distance between a zero and full marks on the course grade.
 */
export function FocusQueue({ items, now }: { items: FocusItem[]; now: Date }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.swing), 1);
  const high = highStakesThreshold(items.map((i) => i.swing));
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-1.5">
            Focus
            <Tooltip content="Ranked by how far each item can move its course grade, from a zero to full marks, with sooner work first. Uses Klar's grade math.">
              <button type="button" aria-label="How Focus ranks work" className="text-ink-3 hover:text-ink">
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          </span>
        }
        description="What's coming up, ranked by what's at stake."
      />
      <ol className="divide-y divide-line border-t border-line">
        {items.map((item, i) => (
          <li key={item.row.id}>
            <Link
              href={`/app/courses/${item.row.courseId}?tab=what-if`}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-5 py-3 transition-colors hover:bg-surface-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_minmax(8rem,12rem)_auto]"
            >
              <span className="tabular font-display text-sm font-extrabold text-ink-3">{i + 1}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{item.row.title}</span>
                  {item.swing >= high && <Badge tone="warning" className="shrink-0">High stakes</Badge>}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: seriesColor(item.row.colorIndex) }} />
                  <span className="truncate">{item.row.courseName}</span>
                  <span className="text-ink-3">·</span>
                  <span className="shrink-0">{dueLabel(item.row.dueAt!, now)}</span>
                </span>
              </span>
              <span className="col-start-2 flex items-center gap-2 sm:col-start-auto" aria-label={`Can move ${item.row.courseName} by up to ${item.swing.toFixed(1)} points`}>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(4, (item.swing / max) * 100)}%`, background: item.swing >= high ? "var(--warning)" : "var(--brand)" }}
                  />
                </span>
                <span className="tabular w-16 shrink-0 text-right text-xs font-bold text-ink">±{item.swing.toFixed(1)} pts</span>
              </span>
              <span className="col-start-2 text-xs text-ink-2 sm:col-start-auto sm:w-40 sm:text-right">
                {item.keep ? (
                  item.keep.alreadySecured ? (
                    <span className="font-semibold text-success">Your {item.keep.letter} is safe either way</span>
                  ) : item.keep.achievable ? (
                    <>
                      Keep your {item.keep.letter}:{" "}
                      <strong className="tabular text-ink">
                        {fmtPoints(item.keep.needed)}/{fmtPoints(item.keep.possible)}
                      </strong>
                    </>
                  ) : (
                    <span className="font-semibold text-danger">Even full marks drops your {item.keep.letter}</span>
                  )
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
