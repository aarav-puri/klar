"use client";
import {
  applyScenario,
  computeGrade,
  EMPTY_SCENARIO,
  requiredScore,
  scenarioIsEmpty,
  type Assignment,
  type WhatIfScenario,
} from "@klar/core";
import { Info, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GradeNumeral } from "@/components/ui/grade-numeral";
import { Input, Label, Select } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { fmtDelta, fmtPoints } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CourseView } from "@/server/data/types";

const parseNum = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? n : null;
};

/**
 * Hypothetical grade calculator. Everything happens in this component's
 * state; nothing is saved and nothing is ever sent to Schoology.
 */
export function WhatIfCalculator({ course }: { course: CourseView }) {
  const [scenario, setScenario] = useState<WhatIfScenario>(EMPTY_SCENARIO);
  const config = course.config;
  const periodId = null;

  const current = useMemo(() => computeGrade(course.assignments, config), [course.assignments, config]);
  const projectedAssignments = useMemo(() => applyScenario(course.assignments, scenario, course.id, periodId), [course.assignments, scenario, course.id]);
  const projected = useMemo(() => computeGrade(projectedAssignments, config), [projectedAssignments, config]);
  const delta = current.percent !== null && projected.percent !== null ? projected.percent - current.percent : null;
  const edited = !scenarioIsEmpty(scenario);

  const groups = useMemo(() => {
    const cats = config.categories.length ? config.categories : [{ id: "__none", name: "Assignments", weight: null }];
    const byCat = new Map<string, Assignment[]>(cats.map((c) => [c.id, []]));
    const other: Assignment[] = [];
    for (const a of course.assignments) {
      const list = a.categoryId ? byCat.get(a.categoryId) : config.categories.length ? undefined : byCat.get("__none");
      (list ?? other).push(a);
    }
    const out = cats.map((c) => ({ id: c.id, name: c.name, weight: c.weight, items: byCat.get(c.id) ?? [] }));
    if (other.length) out.push({ id: "__other", name: "Uncategorized", weight: null, items: other });
    return out.filter((g) => g.items.length > 0);
  }, [course.assignments, config.categories]);

  // One entry per category name for the picker, preferring the one that holds assignments.
  const pickable = useMemo(() => {
    const used = new Set(groups.map((g) => g.id));
    const seen = new Map<string, { id: string; name: string }>();
    for (const c of config.categories) {
      const key = `${c.name.toLowerCase()}|${c.weight}`;
      const prev = seen.get(key);
      if (!prev || (used.has(c.id) && !used.has(prev.id))) seen.set(key, c);
    }
    return [...seen.values()];
  }, [config.categories, groups]);

  const setEdit = (a: Assignment, earnedStr: string) => {
    setScenario((s) => {
      const edits = { ...s.edits };
      const earned = parseNum(earnedStr);
      if (earnedStr.trim() === "" || earned === a.earned) delete edits[a.id];
      else if (earned !== null) edits[a.id] = { earned, possible: a.possible };
      return { ...s, edits };
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-2 space-y-6 lg:order-1">
        {groups.length === 0 && (
          <Panel>
            <p className="px-5 py-4 text-sm text-ink-2">Nothing graded here yet.</p>
          </Panel>
        )}
        {groups.map((g) => (
          <Panel key={g.id}>
            <PanelHeader
              as="h3"
              title={g.name}
              description={
                config.method === "weighted_categories" && g.weight !== null
                  ? `Worth ${fmtPoints(g.weight)}% of the grade`
                  : `${g.items.length} item${g.items.length === 1 ? "" : "s"}`
              }
            />
            <ul className="divide-y divide-line border-t border-line">
              {g.items.map((a) => (
                <ScoreRow key={a.id} a={a} edit={scenario.edits[a.id]} onChange={(v) => setEdit(a, v)} onUndo={() => setEdit(a, "")} />
              ))}
            </ul>
          </Panel>
        ))}

        <AddHypothetical
          categories={pickable}
          hypotheticals={scenario.hypotheticals}
          onAdd={(h) => setScenario((s) => ({ ...s, hypotheticals: [...s.hypotheticals, h] }))}
          onRemove={(id) => setScenario((s) => ({ ...s, hypotheticals: s.hypotheticals.filter((h) => h.id !== id) }))}
        />
      </div>

      <aside className="order-1 lg:order-2">
        <div className="space-y-4 lg:sticky lg:top-24">
          <Panel className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="p-5">
                <p className="text-sm font-semibold text-ink-2">Now</p>
                <GradeNumeral percent={current.percent} muted={edited} className="mt-2 text-[2rem]" />
                <p className="mt-1 text-sm font-bold text-ink-2">{current.letter ?? ""}</p>
              </div>
              <div className={cn("p-5 transition-colors", edited && "bg-brand-wash")}>
                <p className="text-sm font-semibold text-ink-2">With changes</p>
                <motion.div
                  key={projected.percent?.toFixed(2) ?? "none"}
                  initial={{ opacity: 0.35, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                >
                  <GradeNumeral percent={projected.percent} className="mt-2 text-[2rem]" />
                </motion.div>
                <p className="mt-1 flex items-center gap-2 text-sm font-bold text-ink">
                  {projected.letter ?? ""}
                  {delta !== null && edited && Math.abs(delta) >= 0.005 ? (
                    <span className={cn("tabular text-xs", delta > 0 ? "text-success" : "text-danger")}>{fmtDelta(delta)} pts</span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
              <p className="text-xs text-ink-2" aria-live="polite">
                {edited
                  ? `${Object.keys(scenario.edits).length} edited, ${scenario.hypotheticals.length} added`
                  : "Type a score"}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setScenario(EMPTY_SCENARIO)} disabled={!edited}>
                <RotateCcw /> Reset
              </Button>
            </div>
          </Panel>

          <TargetSolver course={course} assignments={projectedAssignments} hypotheticals={scenario.hypotheticals} />

          <div className="rounded-lg border border-line px-4 py-3 text-xs text-ink-2">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
              <Info className="size-3.5" />
              How this is calculated
            </p>
            <p className="mt-1">
              {config.method === "weighted_categories" ? "Weighted by category." : "Points earned over points possible."} Ungraded work doesn&rsquo;t count.
            </p>
            {projected.assumptions.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-4">
                {projected.assumptions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ScoreRow({ a, edit, onChange, onUndo }: { a: Assignment; edit?: { earned: number | null }; onChange: (v: string) => void; onUndo: () => void }) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const disabled = a.status === "excused" || a.status === "incomplete";
  const value = draft ?? (edit ? String(edit.earned ?? "") : "");
  const changed = Boolean(edit);
  return (
    <li className={cn("flex items-center gap-3 px-5 py-2.5 transition-colors", changed && "bg-brand-wash/60")}>
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{a.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          {a.status === "graded" ? (
            <span className="tabular">
              Actual {fmtPoints(a.earned)}/{fmtPoints(a.possible)}
            </span>
          ) : a.status === "missing" ? (
            <Badge tone="danger">Missing, not counted</Badge>
          ) : a.status === "excused" ? (
            <Badge tone="outline">Excused</Badge>
          ) : (
            <span>Not graded yet</span>
          )}
          {a.extraCredit && <Badge tone="brand">Extra credit</Badge>}
        </span>
      </label>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          disabled={disabled}
          value={value}
          placeholder={a.earned === null ? "-" : fmtPoints(a.earned)}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onBlur={() => setDraft(null)}
          className={cn(
            "tabular h-9 w-[4.5rem] rounded-md border bg-surface px-2 text-right text-sm font-bold outline-none transition-[border-color,box-shadow] focus-visible:border-brand focus-visible:shadow-[var(--ring)] disabled:opacity-40",
            changed ? "border-brand" : "border-line-strong",
          )}
          aria-label={`Hypothetical score for ${a.title}`}
        />
        <span className="tabular w-10 text-sm text-ink-3">/ {fmtPoints(a.possible)}</span>
        <button
          type="button"
          onClick={() => (setDraft(null), onUndo())}
          className={cn("rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink", !changed && "invisible")}
          aria-label={`Undo change to ${a.title}`}
        >
          <Undo2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function AddHypothetical({
  categories,
  hypotheticals,
  onAdd,
  onRemove,
}: {
  categories: { id: string; name: string }[];
  hypotheticals: WhatIfScenario["hypotheticals"];
  onAdd: (h: WhatIfScenario["hypotheticals"][number]) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [earned, setEarned] = useState("");
  const [possible, setPossible] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const ids = { t: useId(), c: useId(), e: useId(), p: useId() };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseNum(possible);
    const ea = earned.trim() === "" ? null : parseNum(earned);
    if (p === null || p <= 0) return setError("Points possible must be more than 0.");
    if (earned.trim() !== "" && ea === null) return setError("Enter a score of 0 or more.");
    setError(null);
    onAdd({ id: `hypo-${Date.now()}`, title: title.trim() || "Future assignment", categoryId: categories.length ? cat : null, earned: ea, possible: p });
    setTitle("");
    setEarned("");
  };

  return (
    <Panel>
      <PanelHeader as="h3" title="Add a future assignment" />
      <form onSubmit={submit} className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div className={cn(categories.length ? "" : "sm:col-span-1")}>
          <Label htmlFor={ids.t}>Name</Label>
          <Input id={ids.t} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unit 4 test" maxLength={80} />
        </div>
        {categories.length > 0 && (
          <div>
            <Label htmlFor={ids.c}>Category</Label>
            <Select id={ids.c} value={cat} onChange={(e) => setCat(e.target.value)} className="sm:w-40">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor={ids.e}>Score</Label>
            <Input id={ids.e} type="number" inputMode="decimal" min={0} step="any" value={earned} onChange={(e) => setEarned(e.target.value)} className="tabular w-20 text-right" placeholder="-" />
          </div>
          <span className="pb-2.5 text-ink-3">/</span>
          <div>
            <Label htmlFor={ids.p}>Out of</Label>
            <Input id={ids.p} type="number" inputMode="decimal" min={0} step="any" value={possible} onChange={(e) => setPossible(e.target.value)} className="tabular w-20 text-right" />
          </div>
        </div>
        <Button type="submit" variant="secondary">
          <Plus /> Add
        </Button>
        {error && (
          <p className="text-sm text-danger sm:col-span-4" role="alert">
            {error}
          </p>
        )}
      </form>
      {hypotheticals.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {hypotheticals.map((h) => (
            <li key={h.id} className="flex items-center gap-3 bg-brand-wash/50 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{h.title}</span>
              <span className="text-xs text-ink-2">{categories.find((c) => c.id === h.categoryId)?.name}</span>
              <span className="tabular font-bold">
                {h.earned === null ? "-" : fmtPoints(h.earned)}
                <span className="font-semibold text-ink-3">/{fmtPoints(h.possible)}</span>
              </span>
              <button type="button" onClick={() => onRemove(h.id)} className="rounded-md p-1.5 text-ink-3 hover:bg-surface hover:text-danger" aria-label={`Remove ${h.title}`}>
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** "What do I need on X to get Y%?" */
function TargetSolver({ course, assignments, hypotheticals }: { course: CourseView; assignments: Assignment[]; hypotheticals: WhatIfScenario["hypotheticals"] }) {
  const options = useMemo(
    () => [
      ...hypotheticals.map((h) => ({ id: h.id, title: h.title, possible: h.possible })),
      ...course.assignments.filter((a) => a.status === "ungraded" && a.possible && a.possible > 0 && !a.extraCredit).map((a) => ({ id: a.id, title: a.title, possible: a.possible! })),
    ],
    [course.assignments, hypotheticals],
  );
  const [target, setTarget] = useState("90");
  const [pick, setPick] = useState<string>("");
  const ids = { a: useId(), t: useId() };
  const chosen = options.find((o) => o.id === pick) ?? options[0];
  const t = parseNum(target);

  const result = chosen && t !== null ? requiredScore(assignments, course.config, { assignmentId: chosen.id, possible: chosen.possible, targetPercent: t }) : null;

  if (options.length === 0) {
    return (
      <Panel className="px-5 py-4">
        <p className="text-sm font-bold">Score needed for a target</p>
        <p className="mt-1 text-sm text-ink-2">Add a future assignment first.</p>
      </Panel>
    );
  }

  return (
    <Panel className="px-5 py-4">
      <p className="text-sm font-bold">Score needed for a target</p>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label htmlFor={ids.a} className="text-xs text-ink-2">
            On
          </Label>
          <Select id={ids.a} value={chosen?.id} onChange={(e) => setPick(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={ids.t} className="text-xs text-ink-2">
            To reach
          </Label>
          <div className="relative">
            <Input id={ids.t} type="number" inputMode="decimal" min={0} max={200} step="any" value={target} onChange={(e) => setTarget(e.target.value)} className="tabular w-20 pr-6 text-right" />
            <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-3">%</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        {!result ? (
          <span className="text-ink-2">Enter a target percentage.</span>
        ) : result.alreadySecured ? (
          <span className="font-semibold text-success">You stay at or above {t}% even with a 0 on this.</span>
        ) : result.achievable ? (
          <span>
            You need at least{" "}
            <strong className="tabular">
              {fmtPoints(Math.ceil(result.needed * 100) / 100)}/{fmtPoints(result.possible)}
            </strong>{" "}
            ({((result.needed / result.possible) * 100).toFixed(1)}%).
          </span>
        ) : (
          <span className="text-danger">
            Not reachable with this assignment alone. It would take {fmtPoints(Math.ceil(result.needed * 10) / 10)}/{fmtPoints(result.possible)}.
          </span>
        )}
      </p>
    </Panel>
  );
}
