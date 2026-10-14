/**
 * End-to-end test of the real, built extension in Chromium.
 *
 * Schoology is simulated by intercepting https://lincoln.schoology.com with
 * a fixture gradebook page, so no real account or network access is needed.
 * Run `npm run build:extension` first.
 */
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test";
import { startFakeApi, type FakeApiState } from "./fake-schoology-api";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import pg from "pg";

const EXT = join(__dirname, "../apps/extension/dist");
const FIXTURE = readFileSync(join(__dirname, "../packages/core/test/fixtures/grades-page.html"), "utf8");
const LOGIN_PAGE = `<!doctype html><html><body><form id="s-user-login-form" action="/login"><input name="mail"><input type="password" name="pass"></form></body></html>`;
const APP = "http://localhost:3000";

let context: BrowserContext;
let signedIn = true;
/** When true, the fake Schoology has just posted a score for "Unit 2 Test". */
let unit2Posted = false;
const withUnit2 = (html: string) =>
  html.replace(
    '<td class="grade-column"><span class="no-grade">-</span><span class="max-grade"> / 50</span></td>',
    '<td class="grade-column"><span class="awarded-grade"><span class="rounded-grade">47</span></span><span class="max-grade"> / 50</span></td>',
  );

let server: Server;
let api: { server: import("node:http").Server; state: FakeApiState };

test.beforeAll(async () => {
  // A fake Schoology over real HTTPS. Chromium resolves lincoln.schoology.com to
  // it, so tabs the extension opens itself hit it too (route interception
  // doesn't cover extension-created tabs).
  const dir = mkdtempSync(join(tmpdir(), "klar-e2e-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir, "k.pem"), "-out", join(dir, "c.pem"), "-days", "1", "-subj", "/CN=lincoln.schoology.com"], { stdio: "ignore" });
  server = createServer({ key: readFileSync(join(dir, "k.pem")), cert: readFileSync(join(dir, "c.pem")) }, (req, res) => {
    const url = new URL(req.url ?? "/", "https://lincoln.schoology.com");
    const html = (body: string) => (res.writeHead(200, { "content-type": "text/html" }), res.end(body));
    if (url.pathname.startsWith("/grades/grades")) {
      if (!signedIn) return void (res.writeHead(302, { location: "/login?destination=grades/grades" }), res.end());
      return html(unit2Posted ? withUnit2(FIXTURE) : FIXTURE);
    }
    if (url.pathname.startsWith("/login")) return html(LOGIN_PAGE);
    if (url.pathname === "/oauth/authorize") {
      // Schoology's approval page: the student chooses Allow or Deny.
      const cb = new URL(url.searchParams.get("oauth_callback") ?? "");
      cb.searchParams.set("oauth_token", url.searchParams.get("oauth_token") ?? "");
      const deny = new URL(cb);
      deny.searchParams.set("denied", "1");
      return html(`<html><body><h1>Allow Klar to access your Schoology account?</h1><a id="allow" href="${cb}">Allow</a> <a id="deny" href="${deny}">Deny</a></body></html>`);
    }
    html("<html><body>Home</body></html>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  api = await startFakeApi(4545);
  const port = (server.address() as AddressInfo).port;

  context = await chromium.launchPersistentContext("", {
    // Extensions need full Chromium (not the headless shell).
    channel: "chromium",
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    ignoreHTTPSErrors: true,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP lincoln.schoology.com 127.0.0.1:${port}`,
      "--ignore-certificate-errors",
    ],
  });
  if (context.serviceWorkers().length === 0) await context.waitForEvent("serviceworker");
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
  api?.server.close();
});

/** Speak the Klar protocol from inside the page, exactly as the web app does. */
async function ask(page: Page, request: Record<string, unknown>, timeoutMs = 20_000) {
  return page.evaluate(
    ({ request, timeoutMs }) =>
      new Promise<{ result?: unknown; progress: string[]; timedOut?: boolean }>((resolve) => {
        const id = Math.random().toString(36).slice(2, 14).padEnd(12, "x");
        const progress: string[] = [];
        const timer = setTimeout(() => resolve({ timedOut: true, progress }), timeoutMs);
        window.addEventListener("message", (e) => {
          if (e.source !== window) return;
          const d = e.data as { source?: string; id?: string; result?: unknown; progress?: { stage: string } };
          if (d?.source !== "klar-ext") return;
          if (d.progress) progress.push(d.progress.stage);
          if (d.id === id) {
            clearTimeout(timer);
            resolve({ result: d.result, progress });
          }
        });
        window.postMessage({ source: "klar-app", version: 1, id, request }, location.origin);
      }),
    { request, timeoutMs },
  );
}

test("the web app detects the installed extension", async () => {
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.klarExtension)).toBe("0.1.0");
  const pong = await ask(page, { type: "PING" });
  expect(pong.result).toEqual({ ok: true, data: { version: "0.1.0", protocol: 1 } });
  await page.close();
});

test("requests without consent are ignored", async () => {
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  const r = await ask(page, { type: "CONNECT", host: "lincoln.schoology.com" }, 1500);
  expect(r.timedOut).toBe(true);
  await page.close();
});

test("pages outside the allow-list cannot reach the extension", async () => {
  const page = await context.newPage();
  // Same server, different origin (127.0.0.1 is not allow-listed).
  await page.goto("http://127.0.0.1:3000/privacy");
  expect(await page.evaluate(() => document.documentElement.dataset.klarExtension ?? null)).toBeNull();
  const r = await ask(page, { type: "PING" }, 1500);
  expect(r.timedOut).toBe(true);
  await page.close();
});

test("connect reads the gradebook when already signed in", async () => {
  signedIn = true;
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  const r = await ask(page, { type: "CONNECT", host: "lincoln.schoology.com", consent: true });
  const result = r.result as { ok: boolean; data: { payload: { courses: { name: string; reportedPercent: number }[]; schoologyHost: string } } };
  expect(result.ok).toBe(true);
  expect(result.data.payload.schoologyHost).toBe("lincoln.schoology.com");
  expect(result.data.payload.courses.map((c) => c.name)).toEqual(["AP Calculus BC", "English 11"]);
  expect(result.data.payload.courses[0]!.reportedPercent).toBe(94.6);
  expect(r.progress).toContain("opening");
  // The Schoology tab the extension opened is closed again.
  await expect.poll(() => context.pages().filter((p) => p.url().includes("schoology.com")).length).toBe(0);

  const status = await ask(page, { type: "GET_STATUS" });
  expect(status.result).toMatchObject({ ok: true, data: { connected: true, host: "lincoln.schoology.com" } });
  await page.close();
});

test("sync waits for the student to sign in on Schoology, then continues", async () => {
  signedIn = false;
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  const pending = ask(page, { type: "SYNC" }, 30_000);

  // The extension opens Schoology, which redirects to its sign-in page.
  let schoology: Page | undefined;
  await expect.poll(() => (schoology = context.pages().find((p) => p.url().includes("lincoln.schoology.com/login")))).toBeTruthy();
  await expect(schoology!.locator("input[type=password]")).toBeVisible();

  // The student signs in (simulated). Schoology sends them home; the extension continues to grades.
  signedIn = true;
  await schoology!.goto("https://lincoln.schoology.com/home");

  const r = await pending;
  expect(r.progress).toContain("waiting_for_login");
  expect((r.result as { ok: boolean }).ok).toBe(true);
  await page.close();
});

test("closing the Schoology tab mid-sign-in is reported clearly", async () => {
  signedIn = false;
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  const pending = ask(page, { type: "CONNECT", host: "lincoln.schoology.com", consent: true }, 30_000);
  let schoology: Page | undefined;
  await expect.poll(() => (schoology = context.pages().find((p) => p.url().includes("lincoln.schoology.com/login")))).toBeTruthy();
  await schoology!.close();
  const r = await pending;
  expect(r.result).toMatchObject({ ok: false, error: { code: "TAB_CLOSED" } });
  signedIn = true;
  await page.close();
});

test("opening the gradebook yourself doesn't sync anything", async () => {
  signedIn = true;
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  await ask(page, { type: "CONNECT", host: "lincoln.schoology.com", consent: true });

  const schoology = await context.newPage();
  await schoology.goto("https://lincoln.schoology.com/grades/grades");
  await schoology.waitForTimeout(1500);
  expect(((await ask(page, { type: "GET_STATUS" })).result as { data: { hasPending: boolean } }).data.hasPending).toBe(false);
  expect((await ask(page, { type: "TAKE_PENDING" })).result).toEqual({ ok: true, data: { payload: null } });
  await schoology.close();
  await page.close();
});

test("disconnect clears the extension's state", async () => {
  const page = await context.newPage();
  await page.goto(`${APP}/privacy`);
  expect((await ask(page, { type: "DISCONNECT" })).result).toEqual({ ok: true, data: { ok: true } });
  expect((await ask(page, { type: "GET_STATUS" })).result).toMatchObject({ ok: true, data: { connected: false, host: null } });
  expect((await ask(page, { type: "SYNC" })).result).toMatchObject({ ok: false, error: { code: "NOT_CONNECTED" } });
  await page.close();
});

/* ------------------------------------------------------------------------ */
/* Klar accounts (Neon Auth on the e2e branch)                               */
/* ------------------------------------------------------------------------ */

const branchEnv = parseEnv(readFileSync(join(__dirname, "../apps/web/.env.e2e"), "utf8")) as Record<string, string>;
const runId = Date.now().toString(36);
const email = (tag: string) => `klar-e2e-${tag}-${runId}@example.com`;

/** Create a Klar account through the real sign-up form. */
async function createAccount(page: Page, tag: string, password = "a long klar password") {
  // Start signed out (tests share one browser context); extension state is untouched.
  await context.clearCookies({ domain: "localhost" });
  await page.goto(`${APP}/connect`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("First name").fill("Jordan");
  await page.getByLabel("Email").fill(email(tag));
  await page.getByLabel("Choose a Klar password").fill(password);
  await page.getByRole("checkbox", { name: /13 or older/ }).check();
  await page.getByRole("button", { name: "Create account" }).last().click();
  // Signed in: the connect flow starts.
  await expect(page.getByRole("heading", { name: "Connect your Schoology" })).toBeVisible({ timeout: 30_000 });
}

/** The newest reset token Neon Auth stored for an email (what the emailed link carries). */
async function latestResetToken(address: string): Promise<string> {
  const c = new pg.Client({ connectionString: branchEnv.DATABASE_URL_UNPOOLED!.replace(/sslmode=require/, "sslmode=verify-full") });
  await c.connect();
  try {
    const r = await c.query(
      `select v.identifier from neon_auth.verification v join neon_auth."user" u on v.value = u.id::text
        where u.email = $1 and v.identifier like 'reset-password:%' order by v."createdAt" desc limit 1`,
      [address],
    );
    return String(r.rows[0]?.identifier ?? "").replace(/^reset-password:/, "");
  } finally {
    await c.end();
  }
}

test("full flow: create an account, connect through the extension, recently graded, sign out", async () => {
  signedIn = true;
  unit2Posted = false;
  const page = await context.newPage();

  // The app is closed to signed-out visitors.
  await page.goto(`${APP}/app`);
  await expect(page).toHaveURL(/\/login/);

  await createAccount(page, "ext");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/Extension found/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Schoology address").fill("https://lincoln.schoology.com/home");
  await page.getByRole("button", { name: "Connect and sign in" }).click();
  await expect(page.getByRole("heading", { name: "You\u2019re connected" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/read 2 courses and 6 assignments/i)).toBeVisible();

  await page.getByRole("button", { name: "Open my dashboard" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /, Jordan$/ })).toBeVisible();
  await expect(page.getByLabel("94.6 percent")).toBeVisible();

  // The overview no longer has a Recently graded panel.
  await expect(page.getByRole("heading", { name: "Recently graded" })).toHaveCount(0);

  // The overview has no score log.
  await expect(page.getByRole("heading", { name: "Score log" })).toHaveCount(0);

  // A teacher posts a score; the next sync counts it.
  unit2Posted = true;
  await page.getByRole("button", { name: "Sync now with Schoology" }).click();
  await expect(page.getByText("1 grade changed")).toBeVisible({ timeout: 30_000 });
  unit2Posted = false;

  // Assignments live on the overview too, without a Recently graded group.
  await expect(page.getByRole("heading", { name: "Assignments", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Due in the next 2 weeks/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Recently graded/ })).toHaveCount(0);

  // Navigation is Overview, Planner, Ask Klar and Settings.
  const nav = page.getByRole("navigation").filter({ visible: true }).first();
  for (const name of ["Overview", "Planner", "Ask Klar", "Settings"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  for (const name of ["Courses", "Assignments", "Grade history", "What-if", "Calendar"]) await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(0);
  await nav.getByRole("link", { name: /Ask Klar/ }).click();
  await expect(page.getByRole("heading", { name: "Ask Klar" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Ask Klar isn\u2019t set up on this server yet.")).toBeVisible();

  // Signed in, the landing page offers the dashboard instead of connecting.
  await page.goto(`${APP}/`);
  await expect(page.getByRole("main").getByRole("link", { name: "Go to dashboard" }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("main").getByRole("link", { name: "Connect Schoology" })).toHaveCount(0);
  await page.goto(`${APP}/app`);

  // Course detail: teacher-flagged missing work is shown as missing.
  await page.getByRole("heading", { name: "AP Calculus BC" }).click();
  await expect(page).toHaveURL(/\/app\/courses\//, { timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "Problem Set 4" })).toBeVisible({ timeout: 15_000 });
  // The newly posted score leads the course's recent scores, as just graded.
  await page.getByRole("radio", { name: "History" }).click();
  const recent = page.locator("section", { has: page.getByRole("heading", { name: "Recent scores" }) }).getByRole("listitem");
  await expect(recent.first()).toContainText("Unit 2 Test");
  await expect(recent.first()).toContainText(/graded (just now|1 min ago)/i);
  await expect(recent.nth(1)).toContainText("Unit 1 Test");

  // Signing out ends the session.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP}/`, { timeout: 20_000 });
  await page.goto(`${APP}/app`);
  await expect(page).toHaveURL(/\/login/);
  // The login page renders normally right after signing out.
  await expect(page.getByRole("heading", { name: "Sign in to Klar" })).toBeVisible();
  // And the landing page is back to the signed-out buttons.
  await page.goto(`${APP}/`);
  await expect(page.getByRole("main").getByRole("link", { name: "Connect Schoology" }).first()).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Go to dashboard" })).toHaveCount(0);
  await page.close();
});

test("connecting through the official Schoology API (optional method)", async () => {
  api.state.unit2 = null;
  const page = await context.newPage();
  await createAccount(page, "api");
  await page.getByText("Official Schoology API").click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Schoology address").fill("lincoln.schoology.com");
  await page.getByRole("button", { name: "Continue to Schoology" }).click();
  // Schoology's own approval page, on the school's site.
  await expect(page.getByRole("heading", { name: /Allow Klar/ })).toBeVisible({ timeout: 20_000 });
  await page.locator("#allow").click();
  await expect(page.getByRole("heading", { name: "You\u2019re connected" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/read 2 courses and 5 assignments/i)).toBeVisible();
  expect(api.state.unsignedRequests).toBe(0);

  await page.getByRole("button", { name: "Open my dashboard" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  // The API reports posting times, so recent scores are exact from the first sync.
  await page.getByRole("heading", { name: "English 11" }).click();
  await expect(page).toHaveURL(/\/app\/courses\//, { timeout: 30_000 });
  await page.getByRole("radio", { name: "History" }).click();
  const recent = page.locator("section", { has: page.getByRole("heading", { name: "Recent scores" }) }).getByRole("listitem");
  await expect(recent.first()).toContainText("Personal narrative", { timeout: 15_000 });
  await expect(recent.first()).toContainText(/graded 2 days ago/i);
  await page.goto(`${APP}/app/settings`);
  await expect(page.getByText("Official Schoology API", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.close();
});

test("a denied Schoology approval is explained", async () => {
  const page = await context.newPage();
  await createAccount(page, "deny");
  await page.getByText("Official Schoology API").click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Schoology address").fill("lincoln.schoology.com");
  await page.getByRole("button", { name: "Continue to Schoology" }).click();
  await expect(page.getByRole("heading", { name: /Allow Klar/ })).toBeVisible({ timeout: 20_000 });
  await page.locator("#deny").click();
  await expect(page).toHaveURL(/error=AUTH_REJECTED/, { timeout: 20_000 });
  await page.close();
});

test("forgot password: request a link, set a new password, old one stops working", async () => {
  const page = await context.newPage();
  await createAccount(page, "reset", "the original password");
  await page.getByRole("link", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP}/`, { timeout: 20_000 });

  await page.goto(`${APP}/login`);
  await expect(page.getByRole("heading", { name: "Sign in to Klar" })).toBeVisible();
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/forgot-password/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email("reset"));
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible({ timeout: 20_000 });

  // The emailed link carries this token; read it from the e2e branch instead of an inbox.
  let token = "";
  await expect.poll(async () => (token = await latestResetToken(email("reset"))), { timeout: 15_000 }).not.toBe("");
  await page.goto(`${APP}/reset-password?token=${token}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("New Klar password").fill("a brand new password");
  await page.getByLabel("Type it again").fill("a brand new password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Your password was changed")).toBeVisible({ timeout: 20_000 });

  // The old password no longer works; the email stays filled in after the error.
  await page.getByLabel("Email").fill(email("reset"));
  await page.getByLabel("Klar password").fill("the original password");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page.getByText("That email and password don't match a Klar account.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Email")).toHaveValue(email("reset"));

  // The new one does.
  await page.getByLabel("Klar password").fill("a brand new password");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });

  // The link was single-use.
  await page.goto(`${APP}/reset-password?token=${token}`);
  await page.getByLabel("New Klar password").fill("someone elses password");
  await page.getByLabel("Type it again").fill("someone elses password");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/expired or was already used/)).toBeVisible({ timeout: 20_000 });
  await page.close();
});
