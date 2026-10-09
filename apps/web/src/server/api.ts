import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { RateLimiter } from "./rate-limit";
import { getDb, type Db } from "./db";
import { getViewer } from "./viewer";

export function jsonError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/**
 * Reject cross-site state-changing requests. Browsers always send Origin on
 * POST/PUT/PATCH/DELETE, so a missing or foreign Origin is refused.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return origin !== null && origin === req.nextUrl.origin;
}

type Guard =
  | { ok: true; db: Db; userId: string }
  | { ok: false; response: NextResponse };

/** Require a signed-in student for a mutating API call. */
export async function requireStudent(req: NextRequest, limiter?: RateLimiter): Promise<Guard> {
  if (!sameOrigin(req)) return { ok: false, response: jsonError(403, "ORIGIN_REJECTED", "Cross-site request refused.") };
  const viewer = await getViewer();
  if (viewer.kind !== "user") return { ok: false, response: jsonError(401, "SIGNED_OUT", "Your session ended. Sign in again.") };
  if (limiter) {
    const r = limiter.check(viewer.userId);
    if (!r.ok) {
      return { ok: false, response: jsonError(429, "RATE_LIMITED", "Too many requests. Try again shortly.", { "Retry-After": String(r.retryAfterSec) }) };
    }
  }
  return { ok: true, db: await getDb(), userId: viewer.userId };
}

/** Best-effort client address for rate limiting (first hop from the proxy). */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Read a JSON body with a hard size cap. */
export async function readJson(req: NextRequest, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new Error("too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}
