import { explainChange } from "@klar/core";
import { fmtDay, fmtDelta, fmtPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CourseView } from "@/server/data/types";

/**
 * Why the grade moved: the scores posted since the previous different grade,
 * each with the exact change it caused. Schoology only ever shows the new number.
 */
export function ChangeExplainer({ course }: { course: CourseView }) {
  const change = course.change;
  if (!change) return null;
  const e = explainChange(course.assignments, course.config, change.since);
  const up = change.delta > 0;
  const traced = e.steps.reduce((s, x) => s + (x.delta ?? 0), 0);
  const steps = [...e.steps].sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0)).slice(0, 6);
  const hidden = e.steps.length - steps.length;

  return (
    <section aria-labelledby="why-h" className={cn("nb-border mb-6 rounded-2xl px-5 py-4", up ? "bg-success-wash" : "bg-danger-wash")}>
      <h2 id="why-h" className="text-sm font-bold text-ink">
        Why it&rsquo;s {up ? "up" : "down"} {Math.abs(change.delta).toFixed(1)} pts since {fmtDay(change.since)}
      </h2>
      {e.steps.length === 0 ? (
        <p className="mt-1 text-sm text-ink-2">
          No new scores were posted since then, so the change came from Schoology itself: an edited weight, a dropped score, or a setting Klar can&rsquo;t see.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {steps.map(({ assignment: a, delta }) => (
              <li key={a.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "tabular w-16 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-bold",
                    delta === null ? "bg-surface text-ink-2" : delta >= 0 ? "bg-surface text-success" : "bg-surface text-danger",
                  )}
                >
                  {delta === null ? "New" : fmtDelta(delta)}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{a.title}</span>
                <span className="tabular shrink-0 text-xs text-ink-2">
                  {fmtPoints(a.earned)}/{fmtPoints(a.possible)}
                  {a.possible ? ` (${((a.earned! / a.possible) * 100).toFixed(0)}%)` : ""}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 && <p className="mt-1.5 text-xs text-ink-2">And {hidden} smaller change{hidden === 1 ? "" : "s"}.</p>}
          {Math.abs(traced - change.delta) >= 0.3 && (
            <p className="mt-2 text-xs text-ink-2">
              These scores explain {fmtDelta(traced)} pts by Klar&rsquo;s math. The rest is from settings Schoology doesn&rsquo;t show.
            </p>
          )}
        </>
      )}
    </section>
  );
}
