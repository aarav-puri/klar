import { NextResponse, type NextRequest } from "next/server";
import { authConfigured, getAuth } from "@/server/neon-auth";

/**
 * Protects /app with Neon Auth (and refreshes the session cookie). Every
 * page and API call still checks the session itself, and every student
 * query runs under row-level security.
 */
export default async function proxy(request: NextRequest) {
  if (!authConfigured()) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return getAuth().middleware({ loginUrl: "/login" })(request);
}

export const config = { matcher: ["/app/:path*"] };
