import { normalizeSchoologyHost } from "@klar/core";
import { NextResponse, type NextRequest } from "next/server";
import { seal } from "@/server/crypto";
import { env, officialApiConfigured } from "@/server/env";
import { limiters } from "@/server/rate-limit";
import { authorizeUrl, getRequestToken, SchoologyApiError } from "@/server/schoology/client";
import { getViewer } from "@/server/viewer";

const OAUTH_COOKIE = "klar_oauth";

/**
 * Optional official-API connection, step 1: get a request token and send the
 * signed-in student to their school's own Schoology approval page.
 */
export async function GET(req: NextRequest) {
  const back = (code: string) => NextResponse.redirect(new URL(`/connect?method=api&error=${code}`, req.url));
  if (!officialApiConfigured) return back("NOT_CONFIGURED");
  const viewer = await getViewer();
  if (viewer.kind !== "user") return NextResponse.redirect(new URL("/login?next=/connect", req.url));
  if (!limiters.oauth.check(viewer.userId).ok) return back("RATE_LIMITED");
  if (req.nextUrl.searchParams.get("consent") !== "1") return back("CONSENT_REQUIRED");
  const host = normalizeSchoologyHost(req.nextUrl.searchParams.get("host") ?? "");
  if (!host) return back("HOST_INVALID");

  try {
    const rt = await getRequestToken();
    const callback = new URL("/api/schoology/oauth/callback", env.appUrl).toString();
    const res = NextResponse.redirect(authorizeUrl(host, rt.token, callback));
    // Sealed, short-lived handshake state, bound to this student.
    res.cookies.set(OAUTH_COOKIE, seal(JSON.stringify({ t: rt.token, s: rt.secret, h: host, u: viewer.userId, at: Date.now() })), {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/schoology/oauth",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    return back(e instanceof SchoologyApiError ? e.code : "UNAVAILABLE");
  }
}
