"use client";
import { computeGrade, letterFor, letterPosition, type LetterCutoff } from "@klar/core";
import { useId } from "react";
import { Select } from "@/components/ui/input";
import { PanelHeader } from "@/components/ui/panel";
import { GOAL_TONE_CLASS, goalStatus } from "@/lib/insights";
import { useCoursePlan } from "@/lib/plans-client";
import { cn } from "@/lib/utils";
import type { CourseView } from "@/server/data/types";

/** Letters a student can aim for, best first, with their cutoffs. */
export function goalOptions(scale: LetterCutoff[], current: number | null) {
  const opts = [...scale].sort((a, b) => b.min - a.min).filter((c) => c.min > 0);
  if (current !== null && !opts.some((o) => o.min === current)) opts.push({ letter: `${current}%`, min: current });
  return opts;
}

/** The student's goal for one course and the path to it, from the work still to come. */
export function GoalPanel({ course }: { course: CourseView }) {
  const [plan, update, saving] = useCoursePlan(course.id, course.plan);
  const id = useId();
  const view = { ...course, plan };
  const status = goalStatus(view);
  const now = computeGrade(course.assignments, course.config).percent;
  const pos = letterPosition(now, course.config.scale);
  const path = status?.path ?? null;

  return (
    <>
      <PanelHeader title="Goal" action={saving ? <span className="text-xs text-ink-3">Saving</span> : null} />
      <div className="space-y-4 border-t border-line px-5 py-4">
        {pos && (
          <p className="text-sm text-ink-2">
            {pos.cushion !== null ? (
              <>
                <strong className="tabular text-ink">{pos.cushion.toFixed(1)} pts</strong> above the {pos.letter} cutoff
              </>
            ) : (
              <>At {pos.letter}</>
            )}
            {pos.next && (
              <>
                , <strong className="tabular text-ink">{pos.next.gap.toFixed(1)} pts</strong> from {/^[AEFIO]/.test(pos.next.letter) ? "an" : "a"} {pos.next.letter}
              </>
            )}
            .
          </p>
        )}

        <div>
          <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-2">
            I&rsquo;m aiming for
          </label>
          <Select id={id} value={plan.goalPercent === null ? "" : String(plan.goalPercent)} onChange={(e) => update({ goalPercent: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">No goal</option>
            {goalOptions(course.config.scale, plan.goalPercent).map((o) => (
              <option key={o.letter} value={String(o.min)}>
                {o.letter} ({o.min}% or higher)
              </option>
            ))}
          </Select>
        </div>

        {status && (
          <div className="space-y-3">
            <GoalMeter current={status.current} goal={status.goal} best={path?.best ?? null} />
            <p className={cn("text-sm", GOAL_TONE_CLASS[status.tone])}>{status.label}</p>
            <p className="text-sm text-ink-2">
              {!path ? (
                (status.current ?? 0) >= status.goal ? (
                  <>You&rsquo;re at your goal. Nothing else is posted yet, so hold steady.</>
                ) : (
                  <>Nothing still to come is posted yet. Once your teacher adds upcoming work, Klar shows what it takes.</>
                )
              ) : path.alreadySecured ? (
                <>Your {status.goalLetter} holds even with zeros on the {count(path.remainingCount)} still to come.</>
              ) : path.achievable ? (
                <>
                  Average <strong className="tabular text-ink">{Math.ceil(path.neededAverage * 10) / 10}%</strong> on the {count(path.remainingCount)} still to come ({path.remainingPoints} pts) to finish with {status.goalLetter ?? `${status.goal}%`}.
                </>
              ) : (
                <>
                  Full marks on the {count(path.remainingCount)} posted so far would reach <strong className="tabular text-ink">{path.best.toFixed(1)}%</strong>. Work added later in the term can still close the gap.
                </>
              )}
            </p>
            {path && path.atCurrentPace !== null && !path.alreadySecured && (
              <p className="text-xs text-ink-2">
                At your current average you&rsquo;d finish near <strong className="tabular text-ink">{path.atCurrentPace.toFixed(1)}%</strong> ({letterFor(path.atCurrentPace, course.config.scale)}).
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

const count = (n: number) => (n === 1 ? "1 assignment" : `${n} assignments`);

/** Current grade against the goal on one track, with the best reachable finish marked. */
function GoalMeter({ current, goal, best }: { current: number | null; goal: number; best: number | null }) {
  const lo = Math.max(0, Math.floor(Math.min(current ?? goal, goal, best ?? goal) - 6));
  const hi = Math.min(110, Math.ceil(Math.max(current ?? goal, goal, best ?? goal) + 3));
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const x = (v: number) => `${pct(v)}%`;
  return (
    <div className="relative h-7" aria-hidden>
      <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-surface-2" />
      {best !== null && <div className="absolute top-3 h-1.5 rounded-full bg-brand-wash" style={{ left: 0, width: x(best) }} />}
      {current !== null && <div className="absolute top-3 h-1.5 rounded-full bg-brand" style={{ left: 0, width: x(current) }} />}
      <div className="absolute top-0 h-7 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: x(goal) }} />
      <span
        className="tabular absolute -top-0.5 text-2xs font-bold text-ink"
        style={pct(goal) > 75 ? { right: `calc(${100 - pct(goal)}% + 4px)` } : { left: `calc(${x(goal)} + 4px)` }}
      >
        {goal}%
      </span>
    </div>
  );
}
