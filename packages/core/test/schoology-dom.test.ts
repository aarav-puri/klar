// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeGrade } from "../src/grades";
import { courseFromSync } from "../src/normalize";
import { detectPageKind, parseDue, parseGradeText, parseGradesPage } from "../src/schoology-dom";
import { parseSyncPayload } from "../src/sync";

const html = readFileSync(join(__dirname, "fixtures/grades-page.html"), "utf8");
const doc = () => new DOMParser().parseFromString(html, "text/html");
const URL_ = "https://lincoln.schoology.com/grades/grades";

describe("gradebook page parser", () => {
  it("recognizes page kinds", () => {
    expect(detectPageKind(doc(), URL_)).toBe("grades");
    const login = new DOMParser().parseFromString('<form id="s-user-login-form"><input type="password"></form>', "text/html");
    expect(detectPageKind(login, "https://lincoln.schoology.com/login")).toBe("login");
    expect(parseGradesPage(login, "https://lincoln.schoology.com/login")).toMatchObject({ ok: false, reason: "login" });
  });

  it("fails honestly on unrecognized markup", () => {
    const other = new DOMParser().parseFromString("<div>hello</div>", "text/html");
    expect(parseGradesPage(other, "https://lincoln.schoology.com/home")).toMatchObject({ ok: false, reason: "unrecognized" });
  });

  it("extracts courses, categories, weights and assignments", () => {
    const r = parseGradesPage(doc(), URL_, new Date("2026-10-08T12:00:00"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = parseSyncPayload(r.payload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [calc, english] = parsed.payload.courses;
    expect(calc!.name).toBe("AP Calculus BC");
    expect(calc!.sectionName).toBe("Section 2");
    expect(calc!.sourceId).toBe("s7001");
    expect(calc!.reportedPercent).toBe(94.6);
    expect(calc!.reportedLetter).toBe("A");
    expect(calc!.method).toBe("weighted_categories");
    expect(calc!.categories).toEqual([
      { sourceId: "c11", name: "Tests", weight: 60 },
      { sourceId: "c12", name: "Homework", weight: 40 },
    ]);
    const byTitle = Object.fromEntries(calc!.assignments.map((a) => [a.title, a]));
    expect(byTitle["Unit 1 Test"]).toMatchObject({ earned: 46.5, possible: 50, status: "graded", categorySourceId: "c11", comment: "Nice work on series." });
    expect(byTitle["Unit 1 Test"]!.url).toBe("https://lincoln.schoology.com/assignment/501");
    expect(byTitle["Unit 2 Test"]).toMatchObject({ earned: null, status: "ungraded" });
    expect(byTitle["Problem Set 4"]).toMatchObject({ earned: null, status: "missing" });
    expect(byTitle["Problem Set 5"]).toMatchObject({ status: "excused" });
    expect(byTitle["Bonus puzzle"]).toMatchObject({ extraCredit: true, late: true, url: null });

    expect(english!.method).toBeNull();
    expect(english!.reportedPercent).toBe(88.25);
  });

  it("feeds the grade engine end to end", () => {
    const r = parseGradesPage(doc(), URL_);
    if (!r.ok) throw new Error("parse failed");
    const parsed = parseSyncPayload(r.payload);
    if (!parsed.ok) throw new Error(parsed.error);
    const { course, assignments } = courseFromSync(parsed.payload.courses[0]!);
    const g = computeGrade(assignments, course.config);
    // Tests 46.5/50 = 93; Homework only has extra credit (2/0) → not weightable
    expect(g.percent).toBe(93);
    expect(g.assumptions.join(" ")).toMatch(/only extra credit/);
  });
});

describe("courses with several grading periods", () => {
  // Schoology repeats a course's categories under every period, each with its own row id.
  const html = `<!doctype html><html><body><div id="main"><div id="main-inner">
    <div class="gradebook-course" id="s-js-gradebook-course-8001">
      <div class="gradebook-course-title"><a href="/course/8001/materials">AP Calculus AB</a></div>
      <table><tbody>
        ${[["9101", "Quarter 1", "31", "32", "33"], ["9102", "Quarter 2", "41", "42", "43"]]
          .map(
            ([pid, title, a, h, n]) => `
          <tr class="report-row period-row" data-id="${pid}"><th><span class="title">${title}</span></th><td class="grade-column"></td></tr>
          <tr class="report-row category-row" data-id="${a}" data-parent-id="${pid}"><th><span class="title">Assessment <span class="percentage-contrib">(80%)</span></span></th></tr>
          <tr class="report-row category-row" data-id="${h}" data-parent-id="${pid}"><th><span class="title">Homework <span class="percentage-contrib">(20%)</span></span></th></tr>
          <tr class="report-row category-row" data-id="${n}" data-parent-id="${pid}"><th><span class="title">Non Graded</span></th></tr>`,
          )
          .join("")}
        <tr class="report-row item-row" data-id="701" data-parent-id="41"><th class="title-column"><div class="title"><a href="/assignment/701">Unit 1 Test</a></div></th><td class="grade-column"><span class="awarded-grade"><span class="rounded-grade">42</span></span><span class="max-grade"> / 50</span></td></tr>
        <tr class="report-row item-row" data-id="702" data-parent-id="42"><th class="title-column"><div class="title"><a href="/assignment/702">Review on limits</a></div></th><td class="grade-column"><span class="awarded-grade"><span class="rounded-grade">10</span></span><span class="max-grade"> / 10</span></td></tr>
      </tbody></table>
    </div>
  </div></div></body></html>`;

  it("reports each category once, not once per period", () => {
    const r = parseGradesPage(new DOMParser().parseFromString(html, "text/html"), URL_);
    if (!r.ok) throw new Error("parse failed");
    const parsed = parseSyncPayload(r.payload);
    if (!parsed.ok) throw new Error(parsed.error);
    const course = parsed.payload.courses[0]!;
    expect(course.categories.map((c) => [c.name, c.weight])).toEqual([
      ["Assessment", 80],
      ["Homework", 20],
      ["Non Graded", null],
    ]);
    const ids = new Set(course.categories.map((c) => c.sourceId));
    const byTitle = Object.fromEntries(course.assignments.map((a) => [a.title, a]));
    // Work filed under Quarter 2's rows points at the single category...
    expect(ids.has(byTitle["Unit 1 Test"]!.categorySourceId!)).toBe(true);
    expect(course.categories.find((c) => c.sourceId === byTitle["Unit 1 Test"]!.categorySourceId)!.name).toBe("Assessment");
    expect(course.categories.find((c) => c.sourceId === byTitle["Review on limits"]!.categorySourceId)!.name).toBe("Homework");
    // ...while keeping the period it was filed under.
    expect(byTitle["Unit 1 Test"]!.periodSourceId).toBe("p9102");
    expect(course.periods.map((p) => p.title)).toEqual(["Quarter 1", "Quarter 2"]);
  });
});

describe("text helpers", () => {
  it("parses grade strings", () => {
    expect(parseGradeText("A 94.6%")).toEqual({ percent: 94.6, letter: "A" });
    expect(parseGradeText("(B+) 88%")).toEqual({ percent: 88, letter: "B+" });
    expect(parseGradeText("-")).toEqual({ percent: null, letter: null });
  });
  it("parses due dates", () => {
    const d = new Date(parseDue("Due 9/15/26 11:59pm")!);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 8, 15, 23, 59]);
    const n = new Date(parseDue("Due Oct 3, 2026 8:00 am")!);
    expect([n.getMonth(), n.getDate(), n.getHours()]).toEqual([9, 3, 8]);
    expect(parseDue("")).toBeNull();
    expect(parseDue("whenever")).toBeNull();
  });
});
