"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import type { AssignmentRow } from "@/lib/workload";
import { seriesColor } from "@/lib/chart-colors";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Month grid of due dates. On phones it becomes a day-by-day agenda. */
export function MonthCalendar({ rows, nowIso }: { rows: AssignmentRow[]; nowIso: string }) {
  const today = new Date(nowIso);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const courseOrder = useMemo(() => [...new Set(rows.map((r) => r.courseId))], [rows]);
  const colorIndex = useMemo(() => new Map(rows.map((r) => [r.courseId, r.colorIndex])), [rows]);
  const color = (id: string) => seriesColor(colorIndex.get(id) ?? 99);

  const byDay = useMemo(() => {
    const m = new Map<string, AssignmentRow[]>();
    for (const r of rows) {
      if (!r.dueAt) continue;
      const k = key(new Date(r.dueAt));
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }, [rows]);

  const first = new Date(cursor);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(cursor);
  const inMonth = days.filter((d) => d.getMonth() === cursor.getMonth() && byDay.has(key(d)));

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-lg font-bold tracking-tight" aria-live="polite">{monthLabel}</h2>
        <div className="flex gap-1">
          <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-surface-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" className="rounded-md px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </button>
          <button type="button" className="rounded-md p-2 text-ink-2 hover:bg-surface-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="hidden border-t border-line md:block">
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-ink-3">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const items = byDay.get(key(d)) ?? [];
            const out = d.getMonth() !== cursor.getMonth();
            const isToday = key(d) === key(today);
            return (
              <div key={i} className={cn("min-h-28 border-b border-line p-1.5", i % 7 !== 6 && "border-r", out && "bg-surface-2/50")}>
                <p className={cn("tabular mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold", isToday ? "bg-brand text-white" : out ? "text-ink-3" : "text-ink-2")}>
                  {d.getDate()}
                </p>
                <ul className="space-y-0.5">
                  {items.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/app/courses/${r.courseId}`}
                        className={cn("flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] leading-tight font-semibold hover:bg-surface-2", r.status === "missing" && "text-danger")}
                        title={`${r.title}, ${r.courseName}`}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: color(r.courseId) }} />
                        <span className={cn("truncate", r.earned !== null && "text-ink-3 line-through decoration-ink-3/50")}>{r.title}</span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 3 && <li className="px-1 text-[11px] text-ink-3">{items.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <ul className="divide-y divide-line border-t border-line md:hidden">
        {inMonth.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-2">Nothing due this month.</li>}
        {inMonth.map((d) => (
          <li key={key(d)} className="px-5 py-3">
            <p className={cn("text-xs font-bold", key(d) === key(today) ? "text-brand" : "text-ink-2")}>
              {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(d)}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {byDay.get(key(d))!.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: color(r.courseId) }} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                  <span className="shrink-0 text-xs text-ink-3">{r.courseName}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {courseOrder.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-5 py-3" aria-label="Course colors">
          {courseOrder.map((id) => (
            <li key={id} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="size-2 rounded-full" style={{ background: color(id) }} />
              {rows.find((r) => r.courseId === id)?.courseName}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
