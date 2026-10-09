"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { seriesColor } from "@/lib/chart-colors";
import { fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SnapshotPoint } from "@/server/data/types";

export interface Series {
  id: string;
  name: string;
  /** Stable per course so a color always follows its course. */
  colorIndex: number;
  points: SnapshotPoint[];
}

type Range = "14" | "30" | "90" | "all";
const DAY = 86_400_000;


export function HistoryChart({ series, nowIso, height = 300, title }: { series: Series[]; nowIso: string; height?: number; title: string }) {
  const [range, setRange] = useState<Range>("30");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [asTable, setAsTable] = useState(false);
  const now = Date.parse(nowIso);
  const multi = series.length > 1;

  const { data, visible, domain } = useMemo(() => {
    const start = range === "all" ? -Infinity : now - Number(range) * DAY;
    const byTime = new Map<number, Record<string, number>>();
    const visible = series.filter((s) => !hidden.has(s.id));
    for (const s of visible) {
      for (const p of s.points) {
        const t = Date.parse(p.capturedAt);
        if (t < start || p.percent === null) continue;
        // Bucket to the day so multiple syncs per day share one x position.
        const day = Math.floor(t / DAY) * DAY;
        const row = byTime.get(day) ?? { t: day };
        row[s.id] = Math.round(p.percent * 100) / 100;
        byTime.set(day, row);
      }
    }
    const data = [...byTime.values()].sort((a, b) => a.t! - b.t!);
    const vals = data.flatMap((r) => Object.entries(r).filter(([k]) => k !== "t").map(([, v]) => v));
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 100;
    const pad = Math.max(1, (hi - lo) * 0.15);
    return { data, visible, domain: [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)] as [number, number] };
  }, [series, hidden, range, now]);

  const pointCount = series.reduce((n, s) => n + s.points.filter((p) => p.percent !== null).length, 0);
  if (pointCount < 2) {
    return (
      <EmptyState title="Your history starts with your first sync">
        Schoology doesn&rsquo;t keep a record of past course grades, so Klar starts one from the first time you sync. Check back after a few more syncs to see a trend.
      </EmptyState>
    );
  }

  const summary = visible
    .map((s) => {
      const pts = s.points.filter((p) => p.percent !== null);
      const first = pts[0];
      const last = pts.at(-1);
      return first && last ? `${s.name}: ${first.percent!.toFixed(1)}% on ${fmtDay(first.capturedAt)} to ${last.percent!.toFixed(1)}% on ${fmtDay(last.capturedAt)}` : null;
    })
    .filter(Boolean)
    .join(". ");

  return (
    <figure className="px-2 pb-4 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-3">
        <Segmented
          size="sm"
          label="Time range"
          value={range}
          onChange={setRange}
          options={[
            { value: "14", label: "2W" },
            { value: "30", label: "1M" },
            { value: "90", label: "3M" },
            { value: "all", label: "All" },
          ]}
        />
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-xs font-semibold text-brand-ink hover:underline" aria-pressed={asTable}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {multi && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-3 pb-3" aria-label="Courses shown">
          {series.map((s) => {
            const off = hidden.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={!off}
                  onClick={() =>
                    setHidden((h) => {
                      const n = new Set(h);
                      if (n.has(s.id)) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    })
                  }
                  className={cn("flex items-center gap-1.5 text-xs font-semibold transition-opacity", off ? "text-ink-3 opacity-60" : "text-ink-2 hover:text-ink")}
                >
                  <span className="h-0.5 w-3.5 rounded-full" style={{ background: off ? "var(--line-strong)" : seriesColor(s.colorIndex) }} />
                  {s.name}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {asTable ? (
        <div className="max-h-[360px] overflow-auto px-3">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 text-left text-xs font-semibold text-ink-2">Date</th>
                {visible.map((s) => (
                  <th key={s.id} scope="col" className="py-2 pl-3 text-right text-xs font-semibold text-ink-2">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...data].reverse().map((r) => (
                <tr key={r.t}>
                  <td className="tabular py-1.5 text-ink-2">{fmtDay(new Date(r.t!).toISOString())}</td>
                  {visible.map((s) => (
                    <td key={s.id} className="tabular py-1.5 pl-3 text-right font-semibold">{r[s.id] !== undefined ? `${r[s.id]!.toFixed(2)}%` : "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={`${title}. ${summary}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: multi ? 12 : 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => fmtDay(new Date(t).toISOString())}
                tick={{ fill: "var(--ink-3)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                minTickGap={40}
              />
              <YAxis
                domain={domain}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "var(--ink-3)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-2">
                      <p className="mb-1 text-xs font-semibold text-ink-2">{fmtDay(new Date(Number(label)).toISOString())}</p>
                      <ul className="space-y-0.5">
                        {[...payload]
                          .sort((a, b) => Number(b.value) - Number(a.value))
                          .map((p) => {
                            const s = series.find((x) => x.id === p.dataKey);
                            return (
                              <li key={String(p.dataKey)} className="flex items-center gap-2 text-xs">
                                <span className="size-2 rounded-full" style={{ background: seriesColor(s?.colorIndex ?? 0) }} />
                                <span className="text-ink-2">{s?.name}</span>
                                <span className="tabular ml-auto pl-3 font-bold text-ink">{Number(p.value).toFixed(2)}%</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ) : null
                }
              />
              {visible.map((s) => (
                <Line
                  key={s.id}
                  type="monotone"
                  dataKey={s.id}
                  name={s.name}
                  stroke={seriesColor(s.colorIndex)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                  connectNulls
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}
