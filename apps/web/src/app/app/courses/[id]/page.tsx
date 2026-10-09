import { ChevronLeft, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeChip } from "@/components/app/change-chip";
import { CourseDetail } from "@/components/app/course-detail";
import { Badge } from "@/components/ui/badge";
import { GradeNumeral } from "@/components/ui/grade-numeral";
import { Tooltip } from "@/components/ui/tooltip";
import { fmtDay } from "@/lib/format";
import { flattenAssignments } from "@/lib/workload";
import { getWorkspace } from "@/server/data/workspace";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ws = await getWorkspace();
  return { title: ws?.courses.find((c) => c.id === id)?.name ?? "Course" };
}

export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const ws = (await getWorkspace())!;
  const course = ws.courses.find((c) => c.id === id);
  if (!course) notFound();
  const rows = flattenAssignments([course]);
  const differs = course.percentSource === "schoology" && course.calculatedPercent !== null && course.percent !== null && Math.abs(course.calculatedPercent - course.percent) >= 0.05;
  const estimated = course.config.methodSource !== "schoology";

  return (
    <div>
      <Link href="/app" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" /> Overview
      </Link>

      <header className="mb-8 flex flex-col gap-6 border-b-2 border-nb-line pb-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tighter sm:text-4xl">{course.name}</h1>
          <p className="mt-1 text-ink-2">{[course.teacher, course.sectionName].filter(Boolean).join(", ")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="outline">{course.config.method === "weighted_categories" ? "Weighted categories" : "Total points"}</Badge>
            {estimated && (
              <Tooltip content="Schoology hides this course's grading method. Klar assumes total points.">
                <Badge tone="warning" className="cursor-help">
                  <Info /> Estimated
                </Badge>
              </Tooltip>
            )}
            {course.missingCount > 0 && <Badge tone="danger">{course.missingCount} missing</Badge>}
          </div>
        </div>
        <div className="flex items-end gap-5">
          <div className="text-right">
            <GradeNumeral percent={course.percent} className="text-[3.6rem]" decimals={2} />
            <p className="mt-2 flex items-center justify-end gap-2 text-sm">
              {course.change ? (
                <>
                  <ChangeChip change={course.change} />
                  <span className="text-ink-3">since {fmtDay(course.change.since)}</span>
                </>
              ) : (
                course.percentSource === "calculated" && <span className="text-ink-3">Calculated</span>
              )}
            </p>
          </div>
          {course.letter && (
            <div className="nb-border nb-shadow flex size-[4.5rem] items-center justify-center rounded-2xl bg-nb-pop font-display text-3xl font-extrabold tracking-tight text-nb-text" aria-label={`Letter grade ${course.letter}`}>
              {course.letter}
            </div>
          )}
        </div>
      </header>

      {differs && (
        <p className="mb-6 rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-2">
          Klar&rsquo;s math: {course.calculatedPercent!.toFixed(2)}%. Schoology may hide some settings.
        </p>
      )}

      <CourseDetail course={course} rows={rows} nowIso={ws.generatedAt} initialTab={tab === "what-if" || tab === "history" ? tab : "assignments"} />
    </div>
  );
}
