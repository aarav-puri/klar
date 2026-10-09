/**
 * Product screenshots for the landing page. Signs up a throwaway account on the
 * e2e branch, loads the fictional example courses (never real grades), back-fills
 * their grade history, then captures each feature in light and dark.
 */
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import pg from "pg";
import { buildExampleData } from "../apps/web/src/lib/example-data";

const APP = "http://localhost:3000";
const OUT = join(__dirname, "../apps/web/public/screenshots");
const branchEnv = parseEnv(readFileSync(join(__dirname, "../apps/web/.env.e2e"), "utf8")) as Record<string, string>;
const email = `klar-shots-${Date.now().toString(36)}@example.com`;
const now = new Date();
const example = buildExampleData(now);

function payload() {
  return {
    source: "extension_page",
    schoologyHost: "lincoln.schoology.com",
    capturedAt: now.toISOString(),
    accountLabel: "Jordan Lee",
    courses: example.courses.map(({ course, assignments }) => ({
      sourceId: course.id,
      name: course.name,
      teacher: course.teacher,
      sectionName: course.sectionName,
      reportedPercent: course.reportedPercent,
      reportedLetter: course.reportedLetter,
      method: course.config.methodSource === "schoology" ? course.config.method : null,
      periods: course.periods.map((p) => ({ sourceId: p.id, title: p.title })),
      categories: course.config.categories.map((c) => ({ sourceId: c.id, name: c.name, weight: c.weight })),
      assignments: assignments.map((a) => ({
        sourceId: a.id,
        title: a.title,
        categorySourceId: a.categoryId,
        periodSourceId: a.periodId,
        dueAt: a.dueAt,
        earned: a.earned,
        possible: a.possible,
        status: a.status,
        late: a.late,
        extraCredit: a.extraCredit,
        comment: a.comment,
        url: null,
        gradedAt: a.gradedAt,
      })),
    })),
  };
}

async function backfillHistory() {
  const c = new pg.Client({ connectionString: branchEnv.DATABASE_URL_UNPOOLED!.replace(/sslmode=require/, "sslmode=verify-full") });
  await c.connect();
  try {
    const user = (await c.query(`select id::text from neon_auth."user" where email = $1`, [email])).rows[0]!.id as string;
    const courses = (await c.query(`select id, source_id from public.courses where user_id = $1`, [user])).rows as { id: string; source_id: string }[];
    for (const ex of example.courses) {
      const row = courses.find((r) => r.source_id === ex.course.id);
      if (!row) continue;
      for (const s of ex.snapshots.slice(0, -1)) {
        await c.query(`insert into public.grade_snapshots (user_id, course_id, captured_at, percent) values ($1, $2, $3, $4) on conflict do nothing`, [user, row.id, s.capturedAt, s.percent]);
      }
    }
  } finally {
    await c.end();
  }
}

async function theme(page: Page, mode: "light" | "dark") {
  await page.evaluate((m) => localStorage.setItem("klar-theme", m), mode);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // The Next.js dev badge isn't part of the product.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

test("capture product screenshots", async ({ page }) => {
  // Account
  await page.goto(`${APP}/connect`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Choose a Klar password").fill("a long klar password");
  await page.getByRole("checkbox", { name: /13 or older/ }).check();
  await page.getByRole("button", { name: "Create account" }).last().click();
  await expect(page.getByRole("heading", { name: "Connect your Schoology" })).toBeVisible({ timeout: 30_000 });

  // Example courses, then their history
  const res = await page.evaluate(async (body) => {
    const r = await fetch("/api/sync/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, text: await r.text() };
  }, { payload: payload(), connect: { consent: true } });
  expect(res.status, res.text).toBe(200);
  await backfillHistory();

  for (const mode of ["light", "dark"] as const) {
    await theme(page, mode);
    const out = (name: string) => join(OUT, `${name}-${mode}.png`);

    /** A padded crop around one or more parts of the page, in page coordinates. */
    const crop = async (name: string, targets: ReturnType<Page["locator"]>[], opts: { pad?: number; maxHeight?: number } = {}) => {
      const pad = opts.pad ?? 24;
      await targets[0]!.scrollIntoViewIfNeeded();
      await settle(page);
      const scrollY = await page.evaluate(() => window.scrollY);
      const boxes = await Promise.all(targets.map(async (t) => (await t.boundingBox())!));
      const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
      const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) + scrollY - pad);
      const right = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
      const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + scrollY + pad;
      await page.screenshot({ path: out(name), animations: "disabled", fullPage: true, clip: { x, y, width: right - x, height: Math.min(bottom - y, opts.maxHeight ?? Infinity) } });
    };

    await page.goto(`${APP}/app`);
    await expect(page.getByRole("heading", { name: /Jordan/ })).toBeVisible({ timeout: 30_000 });

    const courses = page.locator("section", { has: page.getByRole("heading", { name: "Courses", exact: true }) });
    await crop("courses", [courses.locator("a").nth(0), courses.locator("a").nth(1)], { pad: 14 });
    const stats = page.locator("section").filter({ hasText: "Unweighted GPA" }).first();
    await crop("gpa", [page.getByRole("heading", { name: /Jordan/ }).locator("span").first(), stats.locator(":scope > div").nth(0), stats.locator(":scope > div").nth(1)]);
    const board = page.locator("section", { has: page.getByRole("heading", { name: "Assignments", exact: true }) });
    await crop("workload", [board.locator("section").filter({ hasText: "Missing" }).first(), board.locator("section").filter({ hasText: "Due in the next 2 weeks" }).first()], { maxHeight: 640 });

    // What-if and history on a course
    await page.getByRole("heading", { name: "AP Calculus BC" }).click();
    await expect(page).toHaveURL(/\/app\/courses\//, { timeout: 30_000 });
    await page.getByRole("radio", { name: "What-if" }).click();
    // A realistic try: 47/50 on the upcoming unit test.
    const input = page.getByLabel("Hypothetical score for Unit 3 Test: Applications");
    await input.fill("47");
    await input.blur();
    await page.evaluate(() => window.scrollTo(0, 0));
    const summary = page.locator("section").filter({ hasText: "With changes" }).first();
    const solver = page.locator("section").filter({ hasText: "Score needed for a target" }).first();
    await crop("whatif", [summary, solver]);
    await page.getByRole("radio", { name: "History" }).click();
    await crop("history", [page.locator("section").filter({ has: page.getByRole("heading", { name: "Grade over time" }) }).first()]);

    // Ask Klar answers one real question.
    await page.goto(`${APP}/app/ask`);
    const box = page.locator("#ask-input");
    if (await box.isVisible().catch(() => false)) {
      await box.fill("What do I need on my next calc test to keep an A?");
      await box.press("Enter");
      await expect(page.getByText(/Calculated from your grades/)).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(2500);
      await crop("ask", [page.locator("canvas[data-bot-avatar]").first(), page.getByText("What do I need on my next calc test to keep an A?"), page.getByText(/Calculated from your grades/).locator("xpath=..")]);
    }
  }
});
