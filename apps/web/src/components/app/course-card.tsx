import Link from "next/link";
import { GradeNumeral } from "@/components/ui/grade-numeral";
import { fmtDay } from "@/lib/format";
import { GOAL_TONE_CLASS, goalStatus } from "@/lib/insights";
import type { CourseView } from "@/server/data/types";
import { ChangeChip } from "./change-chip";
import { Sparkline } from "./sparkline";

export function CourseCard({ course }: { course: CourseView }) {
  const hasTrend = course.snapshots.filter((s) => s.percent !== null).length >= 2;
  const goal = goalStatus(course);
  return (
    <Link
      href={`/app/courses/${course.id}`}
      className="group nb-border nb-shadow nb-lift relative flex flex-col rounded-2xl bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-lg leading-snug font-extrabold tracking-tight text-ink">{course.name}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-2">{[course.teacher, course.sectionName].filter(Boolean).join(", ")}</p>
        </div>
        {course.letter && (
          <span className="nb-border flex h-9 min-w-9 items-center justify-center rounded-lg bg-nb-pop px-1.5 font-display text-base font-extrabold text-nb-text" aria-label={`Letter grade ${course.letter}`}>
            {course.letter}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <GradeNumeral percent={course.percent} className="text-[2.5rem]" />
        {hasTrend ? <Sparkline points={course.snapshots} className="h-8 w-24 shrink-0" label={`${course.name} trend`} /> : null}
      </div>

      {goal && (
        <p className="mt-3 flex items-center gap-2 text-xs">
          <span className="font-semibold text-ink-2">Goal {goal.goalLetter ?? `${goal.goal}%`}</span>
          <span className={GOAL_TONE_CLASS[goal.tone]}>{goal.label}</span>
        </p>
      )}

      <div className="mt-4 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
        {course.change ? (
          <span className="flex items-center gap-1.5">
            <ChangeChip change={course.change} />
            <span className="text-ink-3">since {fmtDay(course.change.since)}</span>
          </span>
        ) : (
          <span className="text-ink-3">{hasTrend ? "No change yet" : "Trend after a few syncs"}</span>
        )}
        {course.missingCount > 0 && (
          <span className="ml-auto font-bold text-danger">
            {course.missingCount} missing
          </span>
        )}
      </div>
    </Link>
  );
}

