import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Sign-in is Neon Auth (managed Better Auth): email + password, sessions and
 * password-reset emails are handled by Neon. Klar never stores passwords.
 *
 * Created lazily so the app can be built without secrets present.
 */
type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: NeonAuth | null = null;

export function authConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET ?? "").length >= 32);
}

export function getAuth(): NeonAuth {
  if (!instance) {
    if (!authConfigured()) {
      throw new Error("Neon Auth is not configured: set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ characters).");
    }
    instance = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    });
  }
  return instance;
}
