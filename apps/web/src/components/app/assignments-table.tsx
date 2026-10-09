"use client";
import { ArrowDown, ArrowUp, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { fmtDay, fmtPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AssignmentRow } from "@/lib/workload";
import { StatusBadges } from "./status-badge";

type Filter = "all" | "graded" | "ungraded" | "missing" | "late";
type SortKey = "due" | "title" | "percent" | "graded";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "graded", label: "Graded" },
  { value: "ungraded", label: "Not graded" },
  { value: "missing", label: "Missing" },
  { value: "late", label: "Late" },
];

function matches(r: AssignmentRow, f: Filter) {
  switch (f) {
    case "graded":
      return r.earned !== null;
    case "ungraded":
      return r.status === "ungraded";
    case "missing":
      return r.status === "missing";
    case "late":
      return r.late;
    default:
      return true;
  }
}

export function AssignmentsTable({ rows, nowIso, showCourse = false }: { rows: AssignmentRow[]; nowIso: string; showCourse?: boolean }) {
  const now = new Date(nowIso);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: -1 });

  const categories = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.categoryId && r.categoryName) m.set(showCourse ? r.categoryName : r.categoryId, r.categoryName);
    return [...m.entries()];
  }, [rows, showCourse]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        matches(r, filter) &&
        (category === "all" || (showCourse ? r.categoryName === category : r.categoryId === category)) &&
        (!needle || r.title.toLowerCase().includes(needle) || r.courseName.toLowerCase().includes(needle)),
    );
    const val = (r: AssignmentRow): string | number => {
      switch (sort.key) {
        case "title":
          return r.title.toLowerCase();
        case "percent":
          return r.percent ?? -1;
        case "graded":
          return r.gradedAt ?? "";
        default:
          return r.dueAt ?? "";
      }
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, q, filter, category, sort, showCourse]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, rows.filter((r) => matches(r, f.value)).length])), [rows]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th scope="col" className={cn("px-3 py-2.5 text-left text-xs font-semibold text-ink-2", className)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : key === "title" ? 1 : -1 }))}
      >
        {label}
        {sort.key === key ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex flex-col gap-3 px-5 pb-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search assignments</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={showCourse ? "Search assignments or courses" : "Search assignments"}
            className="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm outline-none focus-visible:border-brand focus-visible:shadow-[var(--ring)]"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
            <Segmented size="sm" label="Filter assignments" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.value, label: `${f.label} ${counts[f.value] ?? 0}` }))} />
          </div>
          {categories.length > 0 && (
            <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto min-w-36">
              <option value="all">All categories</option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="border-t border-line px-5 py-10 text-center text-sm text-ink-2">No matches.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto border-t border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60">
                <tr className="border-b border-line">
                  {header("title", "Assignment", "pl-5")}
                  {showCourse ? <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-ink-2">Course</th> : null}
                  <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-ink-2">Category</th>
                  {header("due", "Due")}
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-ink-2">Score</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-xs font-semibold text-ink-2">Out of</th>
                  {header("percent", "%", "text-right [&>button]:ml-auto")}
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-left text-xs font-semibold text-ink-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr key={r.id} className={cn("transition-colors hover:bg-surface-2/60", r.status === "missing" && "bg-danger-wash/40")}>
                    <td className="max-w-[320px] py-3 pr-3 pl-5">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold">{r.title}</span>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-ink-3 hover:text-brand" aria-label={`Open ${r.title} in Schoology`}>
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      {r.comment ? <p className="mt-0.5 truncate text-xs text-ink-2" title={r.comment}>{r.comment}</p> : null}
                    </td>
                    {showCourse ? (
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link href={`/app/courses/${r.courseId}`} className="text-ink-2 hover:text-ink hover:underline">
                          {r.courseName}
                        </Link>
                      </td>
                    ) : null}
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">{r.categoryName ?? "-"}</td>
                    <td className="tabular px-3 py-3 whitespace-nowrap text-ink-2">{r.dueAt ? fmtDay(r.dueAt) : "-"}</td>
                    <td className="tabular px-3 py-3 text-right font-bold">{fmtPoints(r.earned)}</td>
                    <td className="tabular px-3 py-3 text-right text-ink-2">{fmtPoints(r.possible)}</td>
                    <td className="tabular px-3 py-3 text-right font-semibold">{r.percent === null ? <span className="text-ink-3">-</span> : `${r.percent.toFixed(1)}%`}</td>
                    <td className="py-3 pr-5 pl-3">
                      <StatusBadges a={r} now={now} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list: score first, details second */}
          <ul className="divide-y divide-line border-t border-line md:hidden">
            {visible.map((r) => (
              <li key={r.id} className="flex gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {[showCourse ? r.courseName : null, r.categoryName, r.dueAt ? `Due ${fmtDay(r.dueAt)}` : null].filter(Boolean).join(", ")}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadges a={r} now={now} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular font-bold">
                    {fmtPoints(r.earned)}
                    <span className="font-semibold text-ink-3">/{fmtPoints(r.possible)}</span>
                  </p>
                  {r.percent !== null && <p className="tabular text-xs font-semibold text-ink-2">{r.percent.toFixed(1)}%</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
