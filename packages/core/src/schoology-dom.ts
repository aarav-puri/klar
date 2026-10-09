/**
 * Read-only parser for the student-facing Schoology gradebook page
 * (https://<school>.schoology.com/grades/grades).
 *
 * It only reads what is already rendered for the signed-in student. It does
 * not read cookies, storage, form fields or anything outside the gradebook
 * container. Selectors follow Schoology's current markup:
 *
 *   .gradebook-course
 *     .gradebook-course-title
 *     tr.period-row     (grading period + course grade)
 *     tr.category-row   (category name + optional "(40%)" weight)
 *     tr.item-row       (assignment; data-parent-id links to category)
 *
 * Schoology can change this markup at any time. When the structure is not
 * recognized the parser returns { ok: false } instead of guessing.
 */

import type { SyncCourse, SyncAssignment, SyncPayloadInput } from "./sync";

export type PageKind = "grades" | "login" | "other";

export type ParseOutcome =
  | { ok: true; payload: SyncPayloadInput }
  | { ok: false; reason: "login" | "unrecognized" | "no_courses"; detail: string };

const LOGIN_PATH = /\/(login|user\/login|saml|sso)\b/i;

export function detectPageKind(doc: Document, href: string): PageKind {
  const url = safeUrl(href);
  if (url && LOGIN_PATH.test(url.pathname)) return "login";
  if (doc.querySelector("#s-user-login-form, form[action*='login'] input[type='password']")) return "login";
  if (doc.querySelector(".gradebook-course, #main-inner .gradebook-course-title")) return "grades";
  return "other";
}

export function parseGradesPage(doc: Document, href: string, now: Date = new Date()): ParseOutcome {
  const kind = detectPageKind(doc, href);
  const url = safeUrl(href);
  if (kind === "login") return { ok: false, reason: "login", detail: "Schoology is asking for sign-in." };
  if (!url) return { ok: false, reason: "unrecognized", detail: "Unknown page address." };

  const courseEls = Array.from(doc.querySelectorAll<HTMLElement>(".gradebook-course"));
  if (courseEls.length === 0) {
    const looksLikeGrades = /\/grades\b/.test(url.pathname);
    return looksLikeGrades && doc.querySelector("#main-inner, #main")
      ? { ok: false, reason: "no_courses", detail: "The grades page has no courses." }
      : { ok: false, reason: "unrecognized", detail: "Gradebook markup not found." };
  }

  const courses: SyncCourse[] = [];
  courseEls.forEach((el, index) => {
    const course = parseCourse(el, index, url.hostname, now);
    if (course) courses.push(course);
  });

  if (courses.length === 0) {
    return { ok: false, reason: "unrecognized", detail: "Courses were present but could not be read." };
  }

  return {
    ok: true,
    payload: {
      source: "extension_page",
      schoologyHost: url.hostname,
      capturedAt: now.toISOString(),
      accountLabel: readAccountLabel(doc),
      courses,
    },
  };
}

function parseCourse(el: HTMLElement, index: number, host: string, now: Date): SyncCourse | null {
  const titleEl = el.querySelector<HTMLElement>(".gradebook-course-title");
  const rawTitle = text(titleEl?.querySelector("a") ?? titleEl);
  if (!rawTitle) return null;
  // Titles look like "AP Calculus BC: Section 3" or "AP Calculus BC: 3 (2026-27)".
  const [name, ...rest] = rawTitle.split(/:\s+/);
  const sectionName = rest.join(": ") || null;

  const idFromEl =
    el.getAttribute("data-id") ??
    el.id.match(/(\d+)/)?.[1] ??
    titleEl?.querySelector("a")?.getAttribute("href")?.match(/\/(?:section|course)\/(\d+)/)?.[1] ??
    null;
  const courseId = idFromEl ? `s${idFromEl}` : `idx${index}`;

  const periods: SyncCourse["periods"] = [];
  const categories: SyncCourse["categories"] = [];
  const assignments: SyncAssignment[] = [];
  // Raw category row id -> the category it is reported as. Schoology repeats a
  // course's categories under every grading period, each with its own row id;
  // rows with the same name and weight are one category, not several.
  const categoryAlias = new Map<string, string>();
  const categoryByKey = new Map<string, string>();
  // Raw category row id -> the grading period it sits under.
  const categoryPeriod = new Map<string, string>();

  let reportedPercent: number | null = null;
  let reportedLetter: string | null = null;
  let sawWeight = false;

  // Course-level grade, when Schoology renders a summary block.
  const summary = el.querySelector<HTMLElement>(".gradebook-course-grade .rounded-grade, .course-grade-value");
  if (summary) ({ percent: reportedPercent, letter: reportedLetter } = parseGradeText(text(summary)));

  const rows = Array.from(el.querySelectorAll<HTMLTableRowElement>("tr.report-row, tr.period-row, tr.category-row, tr.item-row"));
  let currentPeriod: string | null = null;
  let currentCategory: string | null = null;

  for (const row of rows) {
    const rowId = row.getAttribute("data-id");
    const parentId = row.getAttribute("data-parent-id");

    if (row.classList.contains("period-row")) {
      const pid = rowId ? `p${rowId}` : `p${periods.length}`;
      currentPeriod = pid;
      const title = text(row.querySelector(".title")) || `Period ${periods.length + 1}`;
      periods.push({ sourceId: pid, title: stripTrailing(title) });
      const g = parseGradeText(text(row.querySelector(".awarded-grade .rounded-grade, .awarded-grade, .grade-column")));
      // The first period row with a grade is treated as the current course grade.
      if (reportedPercent === null && g.percent !== null) {
        reportedPercent = g.percent;
        reportedLetter = g.letter;
      } else if (reportedLetter === null && g.letter) {
        reportedLetter = g.letter;
      }
      continue;
    }

    if (row.classList.contains("category-row")) {
      const cid = rowId ? `c${rowId}` : `c${categories.length}`;
      currentCategory = cid;
      const titleCell = row.querySelector<HTMLElement>(".title");
      const weightText = text(row.querySelector(".percentage-contrib"));
      const weightMatch = weightText.match(/(\d+(?:\.\d+)?)\s*%/);
      const weight = weightMatch ? Number(weightMatch[1]) : null;
      if (weight !== null) sawWeight = true;
      const name = stripTrailing(text(titleCell).replace(weightText, "")) || "Category";
      if (!categoryAlias.has(cid)) {
        const key = `${name.toLowerCase()}|${weight ?? ""}`;
        const canonical = categoryByKey.get(key);
        if (canonical) {
          categoryAlias.set(cid, canonical);
        } else {
          categoryByKey.set(key, cid);
          categoryAlias.set(cid, cid);
          categories.push({ sourceId: cid, name, weight });
        }
        if (currentPeriod) categoryPeriod.set(cid, currentPeriod);
      }
      continue;
    }

    if (row.classList.contains("item-row")) {
      const aid = rowId ? `a${rowId}` : `a${courseId}-${assignments.length}`;
      const rawCategory = parentId && categoryAlias.has(`c${parentId}`) ? `c${parentId}` : currentCategory;
      const categorySourceId = rawCategory ? (categoryAlias.get(rawCategory) ?? rawCategory) : null;
      const periodSourceId = (rawCategory && categoryPeriod.get(rawCategory)) ?? currentPeriod;
      assignments.push(parseItem(row, aid, categorySourceId, periodSourceId, host, now));
    }
  }

  return {
    sourceId: courseId,
    name: name?.trim() || rawTitle,
    teacher: null,
    sectionName,
    reportedPercent,
    reportedLetter,
    // Weights shown next to categories mean weighted grading. Their absence
    // is not proof of total points, so we report null and let the engine
    // label its assumption.
    method: sawWeight ? "weighted_categories" : null,
    periods,
    categories,
    assignments,
  };
}

function parseItem(
  row: HTMLElement,
  sourceId: string,
  categorySourceId: string | null,
  periodSourceId: string | null,
  host: string,
  now: Date,
): SyncAssignment {
  const titleCell = row.querySelector<HTMLElement>(".title-column .title, .title-column, .title");
  const link = titleCell?.querySelector<HTMLAnchorElement>("a[href]");
  const dueText = text(row.querySelector(".due-date"));
  let title = text(link ?? titleCell);
  if (!link && dueText) title = title.replace(dueText, "");
  title = stripTrailing(title) || "Untitled";

  const gradeCell = row.querySelector<HTMLElement>(".grade-column") ?? row;
  const awardedText = text(gradeCell.querySelector(".awarded-grade .rounded-grade, .awarded-grade"));
  const maxText = text(gradeCell.querySelector(".max-grade"));
  const exception = gradeCell.querySelector(".exception-icon, .exception, [class*='exception-']");
  const exceptionClass = exception?.className ?? "";
  const exceptionText = (text(exception) + " " + text(gradeCell.querySelector(".exception-grade-wrapper"))).toLowerCase();

  const earned = parseNumber(awardedText);
  const possible = parseNumber(maxText.replace(/^\s*\/\s*/, ""));

  let status: SyncAssignment["status"] = earned === null ? "ungraded" : "graded";
  if (/excused/.test(exceptionClass) || /excused/.test(exceptionText)) status = "excused";
  else if (/incomplete/.test(exceptionClass) || /incomplete/.test(exceptionText)) status = "incomplete";
  else if (/missing/.test(exceptionClass) || /missing/.test(exceptionText)) status = earned === null ? "missing" : "graded";

  const late = Boolean(row.querySelector(".late-icon, .late, [class*='late-']")) || /\blate\b/.test(exceptionText);
  const extraCredit =
    possible === 0 ||
    /extra credit/i.test(text(row.querySelector(".item-type, .grade-extra-credit"))) ||
    Boolean(row.querySelector(".extra-credit"));

  const comment = text(row.querySelector(".comment-column .comment, .comment")) || null;

  return {
    sourceId,
    title,
    categorySourceId,
    periodSourceId,
    dueAt: parseDue(dueText, now),
    earned,
    possible,
    status,
    late,
    extraCredit,
    comment,
    url: link ? absolutize(link.getAttribute("href"), host) : null,
  };
}

/* ------------------------------------------------------------------------ */
/* Helpers (exported for tests)                                             */
/* ------------------------------------------------------------------------ */

export function parseGradeText(raw: string): { percent: number | null; letter: string | null } {
  const s = raw.replace(/\s+/g, " ").trim();
  const pct = s.match(/(-?\d+(?:\.\d+)?)\s*%/);
  const letter = s.match(/(?:^|\s|\()([A-F][+-]?)(?=$|\s|\))/);
  return {
    percent: pct ? Number(pct[1]) : null,
    letter: letter?.[1] ?? null,
  };
}

export function parseNumber(raw: string): number | null {
  const m = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Parses "Due 10/12/26 11:59pm", "Due 10/12/2026", "Due Oct 12, 2026 11:59 pm".
 * Interpreted in the browser's local time zone, which is the zone Schoology
 * rendered the page in.
 */
export function parseDue(raw: string, now: Date = new Date()): string | null {
  const s = raw.replace(/^\s*due[:\s]*/i, "").trim().toLowerCase();
  if (!s) return null;
  let y: number | undefined, mo: number | undefined, d: number | undefined;
  const numeric = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const named = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?/);
  if (numeric) {
    mo = Number(numeric[1]) - 1;
    d = Number(numeric[2]);
    y = Number(numeric[3]);
    if (y < 100) y += 2000;
  } else if (named && MONTHS.includes(named[1]!)) {
    mo = MONTHS.indexOf(named[1]!);
    d = Number(named[2]);
    y = named[3] ? Number(named[3]) : now.getFullYear();
  } else {
    return null;
  }
  let h = 23, mi = 59;
  const time = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (time) {
    h = Number(time[1]) % 12;
    mi = Number(time[2]);
    if (time[3] === "pm") h += 12;
    if (!time[3]) h = Number(time[1]);
  }
  const date = new Date(y, mo, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readAccountLabel(doc: Document): string | null {
  const el = doc.querySelector<HTMLElement>("[data-sgy-sitenav='header-my-account-menu'] img[alt], ._3QZ6W img[alt]");
  const alt = el?.getAttribute("alt")?.trim();
  return alt ? alt.slice(0, 120) : null;
}

function text(el: Element | null | undefined): string {
  if (!el) return "";
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(".visually-hidden, .element-invisible, script, style").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

function stripTrailing(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[\s:,-]+$/, "").trim();
}

function absolutize(href: string | null, host: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, `https://${host}`).toString();
  } catch {
    return null;
  }
}

function safeUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}
