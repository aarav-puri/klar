"use client";
import {
  computeGrade,
  detectLevel,
  gpaLetter,
  letterPosition,
  unweightedGpa,
  weightedGpa,
  type CourseLevel,
} from "@klar/core";
import { ArrowDownRight, ArrowUpRight, Info, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { seriesColor } from "@/lib/chart-colors";
import { GOAL_TONE_CLASS, goalStatus, gpaMovers } from "@/lib/insights";
import { usePlans } from "@/lib/plans-client";
import { cn } from "@/lib/utils";
import type { CoursePlan, CourseView } from "@/server/data/types";
import { goalOptions } from "./goal-panel";

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "honors", label: "Honors" },
  { value: "ap", label: "AP / IB" },
];
const SIM_LETTERS = ["A", "B", "C", "D", "F"] as const;
const SIM_PERCENT: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, F: 50 };

export function Planner({ courses }: { courses: CourseView[] }) {
  const [plans, update, saving] = usePlans(Object.fromEntries(courses.map((c) => [c.id, c.plan])));
  const live = useMemo(() => courses.map((c) => ({ ...c, plan: plans[c.id]! })), [courses, plans]);

  return (
    <div className="space-y-8">
      <p className="sr-only" aria-live="polite">
        {saving ? "Saving" : ""}
      </p>
      <GpaLab courses={live} onLevel={(id, level) => update(id, { level })} />
      <section aria-labelledby="goals-h">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="goals-h" className="text-2xl font-extrabold tracking-tight">
              Goals
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">Pick a goal for each class and Klar works out the path.</p>
          </div>
          {saving && <span className="text-xs text-ink-3">Saving</span>}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {live.map((c) => (
            <CoursePlanCard key={c.id} course={c} onChange={(patch) => update(c.id, patch)} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* GPA lab                                                                  */
/* ------------------------------------------------------------------------ */

function GpaLab({ courses, onLevel }: { courses: CourseView[]; onLevel: (id: string, level: CourseLevel | null) => void }) {
  const [sim, setSim] = useState<Record<string, string>>({});
  const level = (c: CourseView) => c.plan.level ?? detectLevel(c.name);
  const real = useMemo(
    () => ({
      un: unweightedGpa(courses).gpa,
      w: weightedGpa(courses.map((c) => ({ percent: c.percent, letter: c.letter, level: level(c) }))).gpa,
    }),
    [courses],
  );
  const simulated = useMemo(() => {
    const rows = courses.map((c) => (sim[c.id] ? { percent: SIM_PERCENT[sim[c.id]!]!, letter: sim[c.id]!, level: level(c) } : { percent: c.percent, letter: c.letter, level: level(c) }));
    return { un: unweightedGpa(rows).gpa, w: weightedGpa(rows).gpa };
  }, [courses, sim]);
  const simulating = Object.keys(sim).length > 0;
  const movers = useMemo(() => gpaMovers(courses), [courses]);
  const n = unweightedGpa(courses).courseCount;

  return (
    <section aria-labelledby="gpa-h">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="gpa-h" className="text-2xl font-extrabold tracking-tight">
            GPA lab
          </h2>
          <p className="mt-0.5 text-sm text-ink-2">Set each class&rsquo;s level, then try letters to see where your GPA lands.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0">
          <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
            <GpaTile label="Unweighted" tip="4.0 scale. A=4, B=3, C=2, D=1. Plus and minus don't count." value={real.un} sim={simulating ? simulated.un : null} />
            <GpaTile label="Weighted" tip="Adds 0.5 for Honors and 1.0 for AP or IB, except on an F. Schools vary, so check yours." value={real.w} sim={simulating ? simulated.w : null} />
          </div>
          <div className="hidden grid-cols-[minmax(0,1fr)_9.5rem_6.5rem_5.5rem] gap-3 border-b border-line px-5 py-2 text-xs font-semibold text-ink-2 sm:grid">
            <span>Class</span>
            <span>Level</span>
            <span className="text-right">Now</span>
            <span>Try</span>
          </div>
          <ul className="divide-y divide-line">
            {courses.map((c) => {
              const letter = gpaLetter(c);
              const auto = detectLevel(c.name);
              return (
                <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_6.5rem_5.5rem]">
                  <span className="col-span-3 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(c.colorIndex) }} />
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                  </span>
                  <Select
                    aria-label={`Level for ${c.name}`}
                    value={c.plan.level ?? ""}
                    onChange={(e) => onLevel(c.id, e.target.value === "" ? null : (e.target.value as CourseLevel))}
                    className="h-9 text-xs"
                  >
                    <option value="">{LEVELS.find((l) => l.value === auto)!.label} (auto)</option>
                    {LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                  <span className="tabular text-right text-sm">
                    {c.percent === null ? <span className="text-ink-3">No grade</span> : <span className="font-bold">{c.percent.toFixed(1)}%</span>}
                    {letter && <span className="ml-1.5 text-ink-2">{letter}</span>}
                  </span>
                  <Select
                    aria-label={`Try a letter for ${c.name}`}
                    value={sim[c.id] ?? ""}
                    onChange={(e) =>
                      setSim((s) => {
                        const next = { ...s };
                        if (e.target.value === "" || e.target.value === letter) delete next[c.id];
                        else next[c.id] = e.target.value;
                        return next;
                      })
                    }
                    className={cn("h-9 text-xs", sim[c.id] && "border-brand bg-brand-wash")}
                  >
                    <option value="">{letter ?? "-"}</option>
                    {SIM_LETTERS.filter((l) => l !== letter).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </li>
              );
            })}
          </ul>
          {simulating && (
            <div className="flex justify-end border-t border-line px-5 py-2.5">
              <Button variant="ghost" size="sm" onClick={() => setSim({})}>
                <RotateCcw /> Back to real grades
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Closest to moving your GPA" description="Plus and minus don't count, so only these edges matter." />
          {movers.length === 0 ? (
            <p className="border-t border-line px-5 py-4 text-sm text-ink-2">No class is near a letter edge right now. Your GPA is steady.</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {movers.slice(0, 5).map((m) => (
                <li key={`${m.course.id}-${m.kind}`}>
                  <Link href={`/app/courses/${m.course.id}?tab=what-if`} className="flex gap-3 px-5 py-3 hover:bg-surface-2">
                    {m.kind === "reach" ? <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-success" /> : <ArrowDownRight className="mt-0.5 size-4 shrink-0 text-danger" />}
                    <span className="min-w-0 text-sm">
                      <span className="block truncate font-semibold">{m.course.name}</span>
                      <span className="block text-ink-2">
                        {m.kind === "reach" ? (
                          <>
                            <strong className="tabular text-ink">{m.gap.toFixed(1)} pts</strong> more turns the {m.from} into {article(m.to)} {m.to}: GPA <span className="tabular font-semibold text-success">+{(1 / n).toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            Only <strong className="tabular text-ink">{m.gap.toFixed(1)} pts</strong> above {article(m.to)} {m.to}: GPA <span className="tabular font-semibold text-danger">−{(1 / n).toFixed(2)}</span> if it slips
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

const article = (letter: string) => (/^[AEFIO]/.test(letter) ? "an" : "a");

function GpaTile({ label, tip, value, sim }: { label: string; tip: string; value: number | null; sim: number | null }) {
  const delta = sim !== null && value !== null ? sim - value : null;
  return (
    <div className={cn("p-5 transition-colors", sim !== null && "bg-brand-wash")}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
        {label}
        <Tooltip content={tip}>
          <button type="button" aria-label={`How ${label.toLowerCase()} GPA is calculated`} className="text-ink-3 hover:text-ink">
            <Info className="size-3.5" />
          </button>
        </Tooltip>
      </p>
      <p className="tabular mt-2 text-[2.1rem] leading-none font-bold tracking-tightest" aria-live="polite">
        {(sim ?? value)?.toFixed(2) ?? "-"}
      </p>
      <p className="tabular mt-1.5 h-4 text-xs font-semibold">
        {delta !== null && Math.abs(delta) >= 0.005 ? (
          <span className={delta > 0 ? "text-success" : "text-danger"}>
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(2)} from {value!.toFixed(2)}
          </span>
        ) : sim !== null ? (
          <span className="text-ink-3">No change</span>
        ) : null}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Goals                                                                    */
/* ------------------------------------------------------------------------ */

function CoursePlanCard({ course, onChange }: { course: CourseView; onChange: (patch: Partial<CoursePlan>) => void }) {
  const status = goalStatus(course);
  const goalId = useId();
  const calc = computeGrade(course.assignments, course.config).percent;
  const current = course.percent ?? calc;

  return (
    <Panel className="flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <Link href={`/app/courses/${course.id}`} className="min-w-0 hover:underline">
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
            <span className="size-2 shrink-0 rounded-full" style={{ background: seriesColor(course.colorIndex) }} />
            <span className="truncate">{course.name}</span>
          </h3>
        </Link>
        <span className="tabular shrink-0 text-sm font-bold">
          {current === null ? <span className="text-ink-3">No grade</span> : `${current.toFixed(1)}%`}
          {course.letter && <span className="ml-1.5 text-ink-2">{course.letter}</span>}
        </span>
      </div>
      <div className="border-t border-line px-5 py-4">
        <div className="sm:max-w-[50%]">
          <label htmlFor={goalId} className="mb-1.5 block text-xs font-semibold text-ink-2">
            Goal
          </label>
          <Select id={goalId} aria-label={`Goal for ${course.name}`} value={course.plan.goalPercent === null ? "" : String(course.plan.goalPercent)} onChange={(e) => onChange({ goalPercent: e.target.value === "" ? null : Number(e.target.value) })} className="h-9">
            <option value="">No goal</option>
            {goalOptions(course.config.scale, course.plan.goalPercent).map((o) => (
              <option key={o.letter} value={String(o.min)}>
                {o.letter} ({o.min}%+)
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-auto border-t border-line px-5 py-4 text-sm">
        {status ? (
          <p>
            <span className={GOAL_TONE_CLASS[status.tone]}>{status.label}</span>
            <span className="text-ink-2">
              {status.path && !status.path.alreadySecured && status.path.achievable
                ? `: average ${Math.ceil(status.path.neededAverage * 10) / 10}% on the ${status.path.remainingCount} assignment${status.path.remainingCount === 1 ? "" : "s"} still to come.`
                : status.path && !status.path.achievable
                  ? `: full marks on posted work reaches ${status.path.best.toFixed(1)}%.`
                  : "."}
            </span>
          </p>
        ) : (
          <LetterEdge percent={current} scale={course.config.scale} />
        )}

      </div>
    </Panel>
  );
}

/** Without a goal, the most useful fact is how far the grade sits from its letter edges. */
function LetterEdge({ percent, scale }: { percent: number | null; scale: CourseView["config"]["scale"] }) {
  const pos = letterPosition(percent, scale);
  if (!pos) return <p className="text-ink-2">No grade yet.</p>;
  return (
    <p className="text-ink-2">
      {pos.cushion !== null && (
        <>
          <strong className="tabular text-ink">{pos.cushion.toFixed(1)} pts</strong> above the {pos.letter} cutoff
        </>
      )}
      {pos.cushion !== null && pos.next && ", "}
      {pos.next && (
        <>
          <strong className="tabular text-ink">{pos.next.gap.toFixed(1)} pts</strong> from {article(pos.next.letter)} {pos.next.letter}
        </>
      )}
      . Set a goal to see the path.
    </p>
  );
}
