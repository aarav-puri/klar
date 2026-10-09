import { unweightedGpa } from "@klar/core";
import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AssignmentsView } from "@/components/app/assignments-view";
import { CourseCard } from "@/components/app/course-card";
import { Greeting } from "@/components/app/greeting";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { flattenAssignments, needsAttention, upcoming } from "@/lib/workload";
import { getWorkspace } from "@/server/data/workspace";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ws = (await getWorkspace())!;
  const now = new Date(ws.generatedAt);

  if (ws.courses.length === 0) {
    return (
      <>
        <Greeting name={ws.displayName} />
        <Panel className="mt-8">
          <EmptyState
            title={ws.connection ? "No courses yet" : "Connect Schoology"}
            action={
              <Button asChild>
                <Link href="/connect">{ws.connection ? "Sync again" : "Connect Schoology"}</Link>
              </Button>
            }
          >
            {ws.connection ? "No graded courses yet." : null}
          </EmptyState>
        </Panel>
      </>
    );
  }

  const rows = flattenAssignments(ws.courses);
  const gpa = unweightedGpa(ws.courses);
  const dueSoon = upcoming(rows, now, 7);
  const attention = needsAttention(ws.courses);
  const changes = ws.courses.filter((c) => c.change && Date.parse(c.change.since) >= now.getTime() - 7 * 86_400_000).length;

  return (
    <div className="space-y-8">
      <Greeting name={ws.displayName} />

      {/* The report line: one horizontal strip rather than four stat cards. */}
      <Panel className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
        <div className="col-span-2 flex items-end justify-between gap-3 border-b border-line p-5 sm:col-span-1 sm:block sm:border-b-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
            Unweighted GPA
            <Tooltip content="4.0 scale. Ungraded classes left out.">
              <button type="button" aria-label="How GPA is calculated" className="text-ink-3 hover:text-ink">
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          </p>
          {gpa.gpa === null ? (
            <span className="text-[2.1rem] font-semibold tracking-tight text-ink-3 sm:mt-2">-</span>
          ) : (
            <span className="tabular block text-[2.1rem] font-bold leading-none tracking-tightest text-ink sm:mt-2">{gpa.gpa.toFixed(2)}</span>
          )}
        </div>
        <Stat label="Courses" value={String(ws.courses.length)} />
        <Stat label="Due this week" value={String(dueSoon.length)} />
        <Stat label="Changed this week" value={String(changes)} className="hidden sm:block" />
      </Panel>

      {attention.length > 0 && (
        <section aria-labelledby="attention" className="nb-border nb-shadow rounded-2xl bg-warning-wash px-5 py-4">
          <h2 id="attention" className="text-sm font-bold text-ink">Needs attention</h2>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {attention.map(({ course, reason }) => (
              <li key={course.id} className="text-sm">
                <Link href={`/app/courses/${course.id}`} className="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  {course.name}
                </Link>
                <span className="text-ink-2">: {reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="courses-h">
        <h2 id="courses-h" className="mb-4 text-2xl font-extrabold tracking-tight">Courses</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ws.courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </section>

      <section aria-labelledby="assignments-h">
        <h2 id="assignments-h" className="mb-4 text-2xl font-extrabold tracking-tight">Assignments</h2>
        <AssignmentsView rows={rows} nowIso={ws.generatedAt} />
      </section>

    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`p-5 ${className ?? ""}`}>
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="tabular mt-2 text-[2.1rem] leading-none font-bold tracking-tightest">{value}</p>
    </div>
  );
}
