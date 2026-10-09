import { NextResponse, type NextRequest } from "next/server";
import { seal, unseal } from "@/server/crypto";
import { asStudent, getDb } from "@/server/db";
import { officialApiConfigured } from "@/server/env";
import { getAccessToken, SchoologyApiError, verifyAccess } from "@/server/schoology/client";
import { getViewer } from "@/server/viewer";

const OAUTH_COOKIE = "klar_oauth";

interface OAuthState {
  /** Request token, its secret, the school host, the Klar user, and when the handshake began. */
  t: string;
  s: string;
  h: string;
  u: string;
  at: number;
}

function readState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(unseal(raw) ?? "null") as Partial<OAuthState> | null;
    return v && typeof v.t === "string" && typeof v.s === "string" && typeof v.h === "string" && typeof v.u === "string" && typeof v.at === "number" ? (v as OAuthState) : null;
  } catch {
    return null;
  }
}

/**
 * Optional official-API connection, step 3: exchange the approved token,
 * verify access by reading the student's Schoology profile, and only then
 * record the connection for the signed-in Klar account.
 */
export async function GET(req: NextRequest) {
  const back = (code: string) => {
    const r = NextResponse.redirect(new URL(`/connect?method=api&error=${code}`, req.url));
    r.cookies.delete({ name: OAUTH_COOKIE, path: "/api/schoology/oauth" });
    return r;
  };
  if (!officialApiConfigured) return back("NOT_CONFIGURED");
  const viewer = await getViewer();
  if (viewer.kind !== "user") return back("SIGNED_OUT");

  const state = readState(req.cookies.get(OAUTH_COOKIE)?.value);
  const returned = req.nextUrl.searchParams.get("oauth_token");
  // The token must be the one issued to this student, in this browser, recently.
  if (!state || state.u !== viewer.userId || Date.now() - state.at > 600_000 || !returned || returned !== state.t) return back("AUTH_STATE_INVALID");
  if (req.nextUrl.searchParams.get("denied") || req.nextUrl.searchParams.get("error")) return back("AUTH_REJECTED");

  try {
    const access = await getAccessToken({ token: state.t, secret: state.s });
    const me = await verifyAccess(access);
    const db = await getDb();
    const now = new Date().toISOString();

    const connectionId = await asStudent(db, viewer.userId, async (tx) => {
      await tx.query(`insert into public.schools (schoology_host) values ($1) on conflict (schoology_host) do nothing`, [state.h]);
      const school = (await tx.query<{ id: string }>(`select id from public.schools where schoology_host = $1`, [state.h])).rows[0]!;
      const previous = (await tx.query<{ school_id: string }>(`select school_id from public.schoology_connections where user_id = $1`, [viewer.userId])).rows[0];
      // Switching schools: start fresh so data from two schools never mixes.
      if (previous && previous.school_id !== school.id) await tx.query(`select public.delete_my_grade_data()`);
      const conn = await tx.query<{ id: string }>(
        `insert into public.schoology_connections (user_id, school_id, method, status, schoology_user_id, account_label, consent_at, updated_at)
         values ($1, $2, 'api', 'active', $3, $4, $5, $5)
         on conflict (user_id) do update set school_id = excluded.school_id, method = 'api', status = 'active', last_error_code = null,
           schoology_user_id = excluded.schoology_user_id, account_label = excluded.account_label, consent_at = excluded.consent_at, updated_at = excluded.updated_at
         returning id`,
        [viewer.userId, school.id, me.uid, me.name, now],
      );
      return conn.rows[0]!.id;
    });

    // The token vault is outside the student role's reach; write it as the server.
    await db.query(
      `insert into private.schoology_tokens (connection_id, user_id, token_ciphertext, secret_ciphertext) values ($1, $2, $3, $4)
       on conflict (connection_id) do update set token_ciphertext = excluded.token_ciphertext, secret_ciphertext = excluded.secret_ciphertext, created_at = now()`,
      [connectionId, viewer.userId, seal(access.token), seal(access.secret)],
    );
    await db.query(`update public.schools set api_supported = true where schoology_host = $1`, [state.h]);

    const r = NextResponse.redirect(new URL("/connect?method=api&step=sync", req.url));
    r.cookies.delete({ name: OAUTH_COOKIE, path: "/api/schoology/oauth" });
    return r;
  } catch (e) {
    if (e instanceof SchoologyApiError) return back(e.code === "UNAUTHORIZED" ? "AUTH_REJECTED" : e.code);
    console.error("[schoology-connect] unexpected", e instanceof Error ? e.message : e);
    return back("UNAVAILABLE");
  }
}
