import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

/**
 * The end-to-end suite runs against a dedicated Neon branch ("e2e"), never
 * production. Create it once and pull its variables:
 *   neon branches create --name e2e --parent production
 *   neon env pull --branch e2e --file apps/web/.env.e2e
 */
const envFile = join(__dirname, "apps/web/.env.e2e");
if (!existsSync(envFile)) throw new Error("Missing apps/web/.env.e2e. See the comment in playwright.config.ts.");
const branchEnv = parseEnv(readFileSync(envFile, "utf8")) as Record<string, string>;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  webServer: {
    command: "npm run dev -w web",
    url: "http://localhost:3000/privacy",
    // A fresh server so it uses the e2e branch and the fake Schoology API.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...branchEnv,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      // Test-only secrets. Never reuse outside the e2e suite.
      NEON_AUTH_COOKIE_SECRET: "e2e-only-cookie-secret-0123456789-abcdefgh",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      SCHOOLOGY_API_BASE: "http://127.0.0.1:4545/v1",
      SCHOOLOGY_CONSUMER_KEY: "e2e-consumer-key",
      SCHOOLOGY_CONSUMER_SECRET: "e2e-consumer-secret",
      // Keep Ask Klar off in tests even if .env.local has a key (no real AI calls).
      AI_GATEWAY_API_KEY: "",
    },
  },
});
