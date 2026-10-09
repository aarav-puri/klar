/**
 * Example grades for the marketing site's illustrations (hero calculator,
 * product preview, feature cards). Fictional teachers and courses, generated
 * deterministically relative to "now" so dates always look current. It is
 * never shown inside the app or presented as a student's data.
 *
 * Example history is not invented separately: each snapshot is the grade
 * computed from the example assignments that had been graded by that day.
 */
import {
  computeGrade,
  defaultConfig,
  DEFAULT_SCALE,
  type Assignment,
  type Course,
  type GradingConfig,
} from "@klar/core";

interface CategorySpec {
  id: string;
  name: string;
  weight: number | null;
  possible: number;
  titles: string[];
}

interface CourseSpec {
  id: string;
  name: string;
  teacher: string;
  section: string;
  ability: number;
  drift: number;
  spread: number;
  method: GradingConfig["method"];
  methodSource: GradingConfig["methodSource"];
  categories: CategorySpec[];
  /** Titles flagged missing by the teacher (no score entered). */
  missing?: string[];
  late?: string[];
  excused?: string[];
  extraCredit?: { title: string; categoryId: string; earned: number };
  /** Titles still to come: [title, categoryId, possible, daysFromNow]. */
  upcoming: [string, string, number, number][];
}

const SPECS: CourseSpec[] = [
  {
    id: "ex-calc",
    name: "AP Calculus BC",
    teacher: "Ms. Ramirez",
    section: "Period 2",
    ability: 0.93,
    drift: 0.025,
    spread: 0.05,
    method: "weighted_categories",
    methodSource: "schoology",
    categories: [
      { id: "calc-tests", name: "Tests", weight: 50, possible: 50, titles: ["Unit 1 Test: Limits", "Unit 2 Test: Derivatives"] },
      { id: "calc-quiz", name: "Quizzes", weight: 30, possible: 20, titles: ["Quiz 1.3 Continuity", "Quiz 2.1 Definition of the derivative", "Quiz 2.4 Chain rule", "Quiz 3.1 Implicit differentiation"] },
      { id: "calc-hw", name: "Homework", weight: 20, possible: 10, titles: ["Problem Set 1", "Problem Set 2", "Problem Set 3", "Problem Set 4", "Problem Set 5", "Problem Set 6", "Problem Set 7"] },
    ],
    missing: ["Problem Set 6"],
    upcoming: [
      ["Quiz 3.3 Related rates", "calc-quiz", 20, 2],
      ["Problem Set 8", "calc-hw", 10, 4],
      ["Unit 3 Test: Applications", "calc-tests", 50, 11],
    ],
  },
  {
    id: "ex-lang",
    name: "AP English Language",
    teacher: "Mr. Whitfield",
    section: "Period 4",
    ability: 0.88,
    drift: 0.018,
    spread: 0.06,
    method: "weighted_categories",
    methodSource: "schoology",
    categories: [
      { id: "lang-essay", name: "Essays", weight: 45, possible: 100, titles: ["Rhetorical analysis: Didion", "Argument essay: Public space", "Synthesis practice"] },
      { id: "lang-read", name: "Reading responses", weight: 25, possible: 15, titles: ["Response: Orwell", "Response: Baldwin", "Response: Solnit", "Response: Kincaid", "Response: Sontag"] },
      { id: "lang-part", name: "Seminar participation", weight: 15, possible: 10, titles: ["Seminar 1", "Seminar 2", "Seminar 3", "Seminar 4"] },
      { id: "lang-final", name: "Semester exam", weight: 15, possible: 100, titles: [] },
    ],
    late: ["Response: Solnit"],
    upcoming: [
      ["Response: Ehrenreich", "lang-read", 15, 1],
      ["Argument essay: Technology", "lang-essay", 100, 9],
    ],
  },
  {
    id: "ex-chem",
    name: "Chemistry Honors",
    teacher: "Dr. Okafor",
    section: "Period 1",
    ability: 0.86,
    drift: 0.035,
    spread: 0.07,
    method: "total_points",
    methodSource: "assumed",
    categories: [
      { id: "chem-lab", name: "Labs", weight: null, possible: 25, titles: ["Lab: Density of solids", "Lab: Flame tests", "Lab: Empirical formula", "Lab: Limiting reagent"] },
      { id: "chem-test", name: "Tests", weight: null, possible: 100, titles: ["Test: Atomic structure", "Test: Bonding"] },
      { id: "chem-hw", name: "Homework", weight: null, possible: 10, titles: ["Worksheet 1.1", "Worksheet 1.4", "Worksheet 2.2", "Worksheet 2.5", "Worksheet 3.1"] },
    ],
    excused: ["Worksheet 2.2"],
    extraCredit: { title: "Bonus: Periodic table puzzle", categoryId: "chem-hw", earned: 3 },
    upcoming: [
      ["Lab: Gas laws", "chem-lab", 25, 3],
      ["Test: Stoichiometry", "chem-test", 100, 8],
    ],
  },
  {
    id: "ex-hist",
    name: "U.S. History",
    teacher: "Ms. Chen",
    section: "Period 6",
    ability: 0.84,
    drift: -0.03,
    spread: 0.07,
    method: "weighted_categories",
    methodSource: "schoology",
    categories: [
      { id: "hist-assess", name: "Assessments", weight: 60, possible: 40, titles: ["Unit test: Colonial America", "DBQ: Causes of revolution", "Unit test: Constitution"] },
      { id: "hist-class", name: "Classwork", weight: 40, possible: 10, titles: ["Primary source: Mayflower Compact", "Map activity", "Federalist 10 annotation", "Timeline project check-in", "Debate prep", "Reading quiz 4"] },
    ],
    missing: ["Debate prep", "Reading quiz 4"],
    upcoming: [["Chapter 7 notes", "hist-class", 10, 1], ["Unit test: Early republic", "hist-assess", 40, 6]],
  },
  {
    id: "ex-span",
    name: "Spanish III",
    teacher: "Sra. Delgado",
    section: "Period 3",
    ability: 0.95,
    drift: 0.004,
    spread: 0.04,
    method: "total_points",
    methodSource: "schoology",
    categories: [
      { id: "span-oral", name: "Oral assessments", weight: null, possible: 20, titles: ["Presentación personal", "Conversación: La familia"] },
      { id: "span-quiz", name: "Quizzes", weight: null, possible: 25, titles: ["Vocabulario 1", "Pretérito vs. imperfecto", "Vocabulario 2"] },
      { id: "span-hw", name: "Práctica", weight: null, possible: 10, titles: ["Práctica 1", "Práctica 2", "Práctica 3", "Práctica 4", "Práctica 5", "Práctica 6"] },
    ],
    upcoming: [["Vocabulario 3", "span-quiz", 25, 5]],
  },
  {
    id: "ex-csa",
    name: "AP Computer Science A",
    teacher: "Mr. Patel",
    section: "Period 5",
    ability: 0.97,
    drift: 0.01,
    spread: 0.03,
    method: "weighted_categories",
    methodSource: "schoology",
    categories: [
      { id: "cs-proj", name: "Projects", weight: 50, possible: 100, titles: ["Project 1: Text adventure", "Project 2: Gradebook class"] },
      { id: "cs-quiz", name: "Quizzes", weight: 30, possible: 20, titles: ["Quiz: Primitive types", "Quiz: Conditionals", "Quiz: Loops"] },
      { id: "cs-lab", name: "Labs", weight: 20, possible: 10, titles: ["Lab: Hello Java", "Lab: Scanner input", "Lab: String methods", "Lab: Nested loops", "Lab: ArrayList basics"] },
    ],
    upcoming: [["Quiz: Arrays", "cs-quiz", 20, 2], ["Project 3: Library system", "cs-proj", 100, 13]],
  },
];

/** Mulberry32: small deterministic PRNG so the demo never changes between loads. */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const TERM_DAYS = 46;

function quantize(score: number, possible: number): number {
  const step = possible >= 50 ? 0.5 : 1;
  return Math.max(0, Math.min(possible, Math.round(score / step) * step));
}

export interface ExampleCourse {
  course: Course;
  assignments: Assignment[];
  snapshots: { capturedAt: string; percent: number | null }[];
}

export function buildExampleData(now: Date = new Date()): { courses: ExampleCourse[]; trackingSince: string } {
  // Anchor on the start of today so the dataset is stable within a day.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30).getTime();
  const termStart = today - TERM_DAYS * DAY;
  const courses: ExampleCourse[] = [];

  SPECS.forEach((spec, ci) => {
    const rand = rng(1000 + ci * 97);
    const items: Assignment[] = [];
    // Interleave categories across the term.
    const queue = spec.categories.flatMap((cat) => cat.titles.map((title, i) => ({ cat, title, order: (i + 0.5) / cat.titles.length + rand() * 0.08 })));
    queue.sort((a, b) => a.order - b.order);

    queue.forEach(({ cat, title }, i) => {
      const progress = (i + 1) / (queue.length + 1);
      const dueAt = termStart + Math.round(progress * (TERM_DAYS - 2) * DAY) + 1 * DAY;
      const gradedAt = dueAt + (1 + Math.floor(rand() * 4)) * DAY;
      const level = spec.ability - spec.drift / 2 + spec.drift * progress + (rand() - 0.5) * 2 * spec.spread;
      const isMissing = spec.missing?.includes(title) ?? false;
      const isExcused = spec.excused?.includes(title) ?? false;
      const graded = gradedAt <= today && !isMissing && !isExcused;
      items.push({
        id: `${spec.id}-${i}`,
        courseId: spec.id,
        categoryId: cat.id,
        periodId: "ex-s1",
        title,
        dueAt: new Date(dueAt).toISOString(),
        earned: graded ? quantize(level * cat.possible, cat.possible) : null,
        possible: cat.possible,
        status: isExcused ? "excused" : isMissing ? "missing" : graded ? "graded" : "ungraded",
        late: spec.late?.includes(title) ?? false,
        extraCredit: false,
        gradedAt: graded ? new Date(gradedAt).toISOString() : null,
        comment: graded && rand() > 0.78 ? pickComment(rand) : null,
        url: null,
      });
    });

    if (spec.extraCredit) {
      const at = today - 9 * DAY;
      items.push({
        id: `${spec.id}-ec`,
        courseId: spec.id,
        categoryId: spec.extraCredit.categoryId,
        periodId: "ex-s1",
        title: spec.extraCredit.title,
        dueAt: new Date(at - DAY).toISOString(),
        earned: spec.extraCredit.earned,
        possible: 0,
        status: "graded",
        late: false,
        extraCredit: true,
        gradedAt: new Date(at).toISOString(),
        comment: null,
        url: null,
      });
    }

    spec.upcoming.forEach(([title, categoryId, possible, days], i) => {
      items.push({
        id: `${spec.id}-u${i}`,
        courseId: spec.id,
        categoryId,
        periodId: "ex-s1",
        title,
        dueAt: new Date(today + days * DAY - (15.5 - 23.98) * 3_600_000).toISOString(),
        earned: null,
        possible,
        status: "ungraded",
        late: false,
        extraCredit: false,
        gradedAt: null,
        comment: null,
        url: null,
      });
    });

    const config = defaultConfig({
      method: spec.method,
      methodSource: spec.methodSource,
      scale: DEFAULT_SCALE,
      scaleSource: spec.methodSource === "assumed" ? "assumed" : "schoology",
      categories: spec.categories.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
    });

    // Daily snapshots from the day "tracking" began, recomputed from what was graded by then.
    const snapshots: ExampleCourse["snapshots"] = [];
    for (let t = termStart + 12 * DAY; t <= today; t += DAY) {
      const visible = items.map((a) =>
        a.gradedAt && Date.parse(a.gradedAt) <= t ? a : { ...a, earned: null, status: a.status === "graded" ? ("ungraded" as const) : a.status },
      );
      snapshots.push({ capturedAt: new Date(t).toISOString(), percent: computeGrade(visible, config).percent });
    }

    courses.push({
      course: {
        id: spec.id,
        name: spec.name,
        teacher: spec.teacher,
        sectionName: spec.section,
        reportedPercent: null,
        reportedLetter: null,
        config,
        periods: [{ id: "ex-s1", title: "Semester 1" }],
      },
      assignments: items,
      snapshots,
    });
  });

  return { courses, trackingSince: new Date(termStart + 12 * DAY).toISOString() };
}


function pickComment(rand: () => number): string {
  const c = [
    "Clear reasoning. Watch units on the last part.",
    "Strong thesis; tighten the second body paragraph.",
    "Great improvement from last time.",
    "See me about question 4.",
    "Nice work.",
  ];
  return c[Math.floor(rand() * c.length)]!;
}
