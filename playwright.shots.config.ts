import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

/**
 * Captures the product screenshots used on the landing page, from the real app
 * filled with Klar's fictional example courses. Runs against the "e2e" Neon
 * branch, never production:  npm run screenshots
 */
const read = (f: string) => (existsSync(f) ? (parseEnv(readFileSync(f, "utf8")) as Record<string, string>) : {});
const branchEnv = read(join(__dirname, "apps/web/.env.e2e"));
const local = read(join(__dirname, "apps/web/.env.local"));
if (!branchEnv.DATABASE_URL) throw new Error("Missing apps/web/.env.e2e. See playwright.config.ts.");

export default defineConfig({
  testDir: "e2e-shots",
  timeout: 240_000,
  workers: 1,
  reporter: [["list"]],
  use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  webServer: {
    command: "npm run dev -w web",
    url: "http://localhost:3000/privacy",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...branchEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEON_AUTH_COOKIE_SECRET: "e2e-only-cookie-secret-0123456789-abcdefgh",
      // Ask Klar answers one real question for its screenshot.
      AI_GATEWAY_API_KEY: local.AI_GATEWAY_API_KEY ?? "",
    },
  },
});
