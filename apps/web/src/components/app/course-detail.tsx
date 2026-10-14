"use client";
import { computeGrade } from "@klar/core";
import { useMemo, useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { fmtDay, relativeTime } from "@/lib/format";
import type { CourseView } from "@/server/data/types";
import { byMostRecentScore, type AssignmentRow } from "@/lib/workload";
import { AssignmentsTable } from "./assignments-table";
import { CategoryBreakdown } from "./category-breakdown";
import { GoalPanel } from "./goal-panel";
import { HistoryChart } from "./history-chart";
import { PointsBreakdown } from "./points-breakdown";
import { WhatIfCalculator } from "./what-if";

type Tab = "assignments" | "what-if" | "history";

export function CourseDetail({ course, rows, nowIso, initialTab }: { course: CourseView; rows: AssignmentRow[]; nowIso: string; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const result = useMemo(() => computeGrade(course.assignments, course.config), [course]);

  const setTabAndUrl = (t: Tab) => {
    setTab(t);
    const url = new URL(location.href);
    if (t === "assignments") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    history.replaceState(null, "", url);
  };

  const recent = byMostRecentScore(rows).slice(0, 8);

  return (
    <div>
      <Segmented
        label="Course view"
        value={tab}
        onChange={setTabAndUrl}
        options={[
          { value: "assignments", label: "Assignments" },
          { value: "what-if", label: "What-if" },
          { value: "history", label: "History" },
        ]}
        className="mb-6"
      />

      {tab === "assignments" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel className="min-w-0">
            <PanelHeader title="Assignments" />
            <AssignmentsTable rows={rows} nowIso={nowIso} />
          </Panel>
          <div className="space-y-6">
            <Panel>
              <GoalPanel key={course.id} course={course} />
            </Panel>
            <Panel>
              <PanelHeader title="Categories" />
              <CategoryBreakdown result={result} method={course.config.method} />
            </Panel>
            {result.rawPercent !== null && (
              <Panel>
                <PanelHeader title="Where your points went" />
                <PointsBreakdown course={course} result={result} />
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === "what-if" && <WhatIfCalculator course={course} />}

      {tab === "history" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel>
            <PanelHeader title="Grade over time" />
            <HistoryChart title={`${course.name} grade history`} nowIso={nowIso} series={[{ id: course.id, name: course.name, colorIndex: 0, points: course.snapshots }]} />
          </Panel>
          <Panel>
            <PanelHeader title="Recent scores" />
            {recent.length === 0 ? (
              <p className="border-t border-line px-5 py-6 text-sm text-ink-2">No scores yet.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{r.title}</span>
                      <span className="block text-xs text-ink-3">
                        {r.gradedAt ? `Graded ${relativeTime(r.gradedAt, new Date(nowIso)).toLowerCase()}` : r.dueAt ? `Due ${fmtDay(r.dueAt)}` : "Posting date unknown"}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-sm font-bold">{r.percent === null ? "-" : `${r.percent.toFixed(0)}%`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
