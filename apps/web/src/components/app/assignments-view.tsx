"use client";
import { useMemo, useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { awaitingGrade, missing, upcoming, type AssignmentRow } from "@/lib/workload";
import { AssignmentLine } from "./assignment-line";
import { AssignmentsTable } from "./assignments-table";
import { CrunchRadar } from "./crunch-radar";
import { MonthCalendar } from "./month-calendar";

type View = "board" | "list" | "calendar";

export function AssignmentsView({ rows, nowIso }: { rows: AssignmentRow[]; nowIso: string }) {
  const [view, setView] = useState<View>("board");
  const now = new Date(nowIso);
  const groups = useMemo(
    () => ({
      upcoming: upcoming(rows, now, 14),
      missing: missing(rows),
      awaiting: awaitingGrade(rows, now),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, nowIso],
  );

  return (
    <div>
      <Segmented
        label="Assignments view"
        value={view}
        onChange={setView}
        options={[
          { value: "board", label: "Workload" },
          { value: "list", label: "All assignments" },
          { value: "calendar", label: "Calendar" },
        ]}
        className="mb-6"
      />
      {view === "board" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CrunchRadar rows={rows} nowIso={nowIso} />
          <Group title="Due in the next 2 weeks" empty="Nothing due soon." rows={groups.upcoming} mode="due" now={now} />
          <Group
            title="Missing"
            description={groups.missing.some((r) => r.recovery) ? "What each one is worth if you turn it in." : undefined}
            empty="Nothing missing."
            rows={groups.missing}
            mode="missing"
            now={now}
          />
          <Group
            title="Awaiting a grade"
            empty="All graded."
            rows={groups.awaiting}
            mode="due"
            now={now}
          />
        </div>
      )}
      {view === "list" && (
        <Panel className="pt-4">
          <AssignmentsTable rows={rows} nowIso={nowIso} showCourse />
        </Panel>
      )}
      {view === "calendar" && <MonthCalendar rows={rows} nowIso={nowIso} />}
    </div>
  );
}

function Group({ title, description, empty, rows, mode, now }: { title: string; description?: string; empty: string; rows: AssignmentRow[]; mode: "due" | "missing" | "graded"; now: Date }) {
  return (
    <Panel>
      <PanelHeader title={<span>{title} <span className="tabular ml-1 font-semibold text-ink-3">{rows.length}</span></span>} description={description} />
      {rows.length === 0 ? (
        <p className="border-t border-line px-5 py-6 text-sm text-ink-2">{empty}</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto border-t border-line">
          {rows.map((r) => (
            <AssignmentLine key={r.id} row={r} mode={mode} now={now} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
