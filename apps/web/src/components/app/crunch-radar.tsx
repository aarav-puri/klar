"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { seriesColor } from "@/lib/chart-colors";
import { useClientOnly } from "@/lib/use-local-setting";
import { cn } from "@/lib/utils";
import type { AssignmentRow } from "@/lib/workload";

const WEEKS = 3;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

interface Day {
  date: Date;
  items: AssignmentRow[];
  /** Sum of the items' swings: how much grade is riding on this day. */
  load: number;
}

/**
 * The next three weeks as a heatmap of grade stakes, not item counts: a day
 * with one big test reads hotter than a day with three worksheets.
 */
export function CrunchRadar({ rows, nowIso }: { rows: AssignmentRow[]; nowIso: string }) {
  // Days are the student's local days, which the server can't know.
  const ready = useClientOnly(() => true);
  const today = useMemo(() => {
    const n = new Date(nowIso);
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, [nowIso]);

  const days = useMemo<Day[]>(() => {
    const byDay = new Map<string, AssignmentRow[]>();
    for (const r of rows) {
      if (!r.dueAt || r.status !== "ungraded") continue;
      const k = dayKey(new Date(r.dueAt));
      byDay.set(k, [...(byDay.get(k) ?? []), r]);
    }
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const items = (byDay.get(dayKey(date)) ?? []).sort((a, b) => (b.swing ?? 0) - (a.swing ?? 0));
      return { date, items, load: items.reduce((s, r) => s + (r.swing ?? 0), 0) };
    });
  }, [rows, today]);

  const peak = Math.max(...days.map((d) => d.load), 0);
  const crunch = useMemo(() => {
    // A crunch day carries at least twice a typical busy day's stakes, or three or more items.
    const busy = days.filter((d) => d.load > 0).map((d) => d.load).sort((a, b) => a - b);
    const median = busy.length ? busy[Math.floor(busy.length / 2)]! : 0;
    return new Set(days.filter((d) => d.items.length >= 3 || (d.load > 0 && busy.length >= 3 && d.load >= 2 * median && d.load >= 3)).map((d) => dayKey(d.date)));
  }, [days]);

  const heaviest = days.reduce<Day | null>((m, d) => (d.load > (m?.load ?? 0) ? d : m), null);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = days.find((d) => dayKey(d.date) === selected) ?? heaviest;

  if (!ready || days.every((d) => d.items.length === 0)) return null;

  const level = (load: number) => (load <= 0 || peak <= 0 ? 0 : Math.min(4, Math.ceil((load / peak) * 4)));

  return (
    <Panel className="lg:col-span-2">
      <PanelHeader
        title="Crunch radar"
        description={
          heaviest ? (
            <>
              Heaviest day: <strong className="text-ink">{shortFmt.format(heaviest.date)}</strong>, with {heaviest.items.length} item{heaviest.items.length === 1 ? "" : "s"} that can move your grades a combined {heaviest.load.toFixed(1)} pts.
            </>
          ) : (
            "The next three weeks, shaded by what's at stake."
          )
        }
      />
      <div className="grid gap-5 border-t border-line px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Due dates for the next three weeks">
            {days.slice(0, 7).map((d) => (
              <p key={`h-${dayKey(d.date)}`} className="text-center text-2xs font-semibold text-ink-3" aria-hidden>
                {new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(d.date)}
              </p>
            ))}
            {days.map((d) => {
              const k = dayKey(d.date);
              const lv = level(d.load);
              const isShown = shown && dayKey(shown.date) === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(k)}
                  aria-pressed={Boolean(isShown)}
                  aria-label={`${dayFmt.format(d.date)}: ${d.items.length} due${d.load > 0 ? `, ${d.load.toFixed(1)} points at stake` : ""}${crunch.has(k) ? ", crunch day" : ""}`}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-bold transition-[transform,box-shadow] hover:-translate-y-0.5",
                    isShown ? "nb-border nb-shadow" : "border-2 border-transparent",
                    lv >= 3 ? "text-white" : "text-ink",
                  )}
                  style={{ background: lv === 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--brand) ${[0, 18, 38, 62, 88][lv]}%, var(--surface))` }}
                >
                  <span className="tabular">{d.date.getDate()}</span>
                  {d.items.length > 0 && <span className="tabular text-[9px] leading-none font-semibold opacity-80">{d.items.length}</span>}
                  {crunch.has(k) && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-warning ring-2 ring-surface" aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-2xs text-ink-3">
            <span>Less at stake</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((lv) => (
                <span key={lv} className="size-3 rounded" style={{ background: lv === 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--brand) ${[0, 18, 38, 62, 88][lv]}%, var(--surface))` }} />
              ))}
            </span>
            <span>More</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-warning" /> Crunch day
            </span>
          </div>
        </div>

        <div className="min-w-0" aria-live="polite">
          {shown && (
            <>
              <p className="text-sm font-bold">
                {dayFmt.format(shown.date)}
                {crunch.has(dayKey(shown.date)) && <span className="ml-2 text-xs font-bold text-warning">Crunch day</span>}
              </p>
              {shown.items.length === 0 ? (
                <p className="mt-2 text-sm text-ink-2">Nothing due.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {shown.items.map((r) => (
                    <li key={r.id}>
                      <Link href={`/app/courses/${r.courseId}?tab=what-if`} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-surface-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(r.colorIndex) }} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                        <span className="tabular shrink-0 text-xs text-ink-2">{r.swing === null ? "No points listed" : `±${r.swing.toFixed(1)} pts`}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {crunch.has(dayKey(shown.date)) && <CrunchTip day={shown} days={days} />}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Points at the lightest day before a crunch, so heavy work can start early. */
function CrunchTip({ day, days }: { day: Day; days: Day[] }) {
  const before = days.filter((d) => d.date < day.date);
  if (before.length === 0) return null;
  const lightest = before.reduce((m, d) => (d.load < m.load ? d : m), before.at(-1)!);
  const big = day.items[0];
  if (!big) return null;
  return (
    <p className="mt-3 rounded-lg bg-warning-wash px-3 py-2 text-xs text-ink">
      {lightest.load === 0 ? "Nothing is due" : "Little is due"} on <strong>{shortFmt.format(lightest.date)}</strong>. Starting <strong>{big.title}</strong> then spreads this day out.
    </p>
  );
}
