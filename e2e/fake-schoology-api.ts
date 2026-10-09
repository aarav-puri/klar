/**
 * A minimal stand-in for api.schoology.com used by the end-to-end tests. It
 * implements the OAuth 1.0a three-legged handshake and the read endpoints
 * Klar calls, and verifies every request is signed with HMAC-SHA1. IDs match
 * the gradebook fixture so the extension and the API describe the same data.
 */
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

export const CONSUMER = { key: "e2e-consumer-key", secret: "e2e-consumer-secret" };
const REQUEST = { token: "req-token-1", secret: "req-secret-1" };
const ACCESS = { token: "acc-token-1", secret: "acc-secret-1" };

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Recompute the request's signature, as Schoology would. */
function signatureValid(req: IncomingMessage, base: string, tokenSecret: string): boolean {
  const header = req.headers.authorization ?? "";
  const params = Object.fromEntries([...header.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1]!, decodeURIComponent(m[2]!)]));
  if (params.oauth_consumer_key !== CONSUMER.key || !params.oauth_signature) return false;
  const url = new URL(req.url ?? "/", base);
  const all: [string, string][] = Object.entries(params).filter(([k]) => k !== "oauth_signature" && k !== "realm");
  url.searchParams.forEach((v, k) => all.push([k, v]));
  const normalized = all.map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => (a[0] === b[0] ? (a[1]! < b[1]! ? -1 : 1) : a[0]! < b[0]! ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
  const baseString = ["GET", enc(`${url.protocol}//${url.host}${url.pathname}`), enc(normalized)].join("&");
  const expected = createHmac("sha1", `${enc(CONSUMER.secret)}&${enc(tokenSecret)}`).update(baseString).digest("base64");
  return expected === params.oauth_signature;
}

export interface FakeApiState {
  /** Set when the teacher "posts" a score for Unit 2 Test. */
  unit2: { grade: number; timestamp: number } | null;
  signedRequests: number;
  unsignedRequests: number;
}

export function startFakeApi(port: number): Promise<{ server: Server; state: FakeApiState; base: string }> {
  const state: FakeApiState = { unit2: null, signedRequests: 0, unsignedRequests: 0 };
  const base = `http://127.0.0.1:${port}`;
  const now = () => Math.floor(Date.now() / 1000);
  const fiveDaysAgo = now() - 5 * 86_400;
  const twoDaysAgo = now() - 2 * 86_400;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", base);
    const path = url.pathname.replace(/^\/v1/, "");
    const json = (body: unknown) => (res.writeHead(200, { "content-type": "application/json" }), res.end(JSON.stringify(body)));
    const form = (body: string) => (res.writeHead(200, { "content-type": "application/x-www-form-urlencoded" }), res.end(body));

    const tokenSecret = path === "/oauth/request_token" ? "" : path === "/oauth/access_token" ? REQUEST.secret : ACCESS.secret;
    if (!signatureValid(req, base, tokenSecret)) {
      state.unsignedRequests++;
      res.writeHead(401);
      return res.end("invalid signature");
    }
    state.signedRequests++;

    if (path === "/oauth/request_token") return form(`oauth_token=${REQUEST.token}&oauth_token_secret=${REQUEST.secret}`);
    if (path === "/oauth/access_token") {
      if (!(req.headers.authorization ?? "").includes(`oauth_token="${REQUEST.token}"`)) return (res.writeHead(401), res.end());
      return form(`oauth_token=${ACCESS.token}&oauth_token_secret=${ACCESS.secret}`);
    }
    if (!(req.headers.authorization ?? "").includes(`oauth_token="${ACCESS.token}"`)) return (res.writeHead(401), res.end());
    if (path === "/users/me") return (res.writeHead(303, { location: `${base}/v1/users/777` }), res.end());
    if (path === "/users/777") return json({ uid: "777", name_display: "Jordan Lee" });
    if (path === "/users/777/sections") {
      return json({ section: [{ id: 7001, course_title: "AP Calculus BC", section_title: "Section 2", instructors: [{ name_display: "Ms. Ramirez" }] }, { id: 7002, course_title: "English 11", section_title: "" }] });
    }
    if (path === "/users/777/grades") {
      return json({
        section: [
          {
            section_id: 7001,
            period: [
              {
                period_id: 9001,
                period_title: "2026-2027 Semester 1",
                assignment: [
                  { assignment_id: 501, grade: 46.5, max_points: 50, category_id: 11, timestamp: fiveDaysAgo },
                  ...(state.unit2 ? [{ assignment_id: 502, grade: state.unit2.grade, max_points: 50, category_id: 11, timestamp: state.unit2.timestamp }] : []),
                  { assignment_id: 503, grade: null, max_points: 10, category_id: 12, exception: 3 },
                  { assignment_id: 504, grade: null, max_points: 10, category_id: 12, exception: 1 },
                ],
              },
            ],
            final_grade: [{ period_id: 9001, grade: 94.6 }],
          },
          {
            section_id: 7002,
            period: [{ period_id: 9002, period_title: "Quarter 1", assignment: [{ assignment_id: 601, grade: 44, max_points: 50, category_id: 21, timestamp: twoDaysAgo }] }],
            final_grade: [{ period_id: 9002, grade: 88.25 }],
          },
        ],
      });
    }
    if (path === "/sections/7001/assignments") {
      return json({
        assignment: [
          { id: 501, title: "Unit 1 Test", due: "2026-09-15 23:59:00", max_points: 50, grading_category: 11, grading_period: 9001 },
          { id: 502, title: "Unit 2 Test", due: "2026-10-20 23:59:00", max_points: 50, grading_category: 11, grading_period: 9001 },
          { id: 503, title: "Problem Set 4", max_points: 10, grading_category: 12, grading_period: 9001 },
          { id: 504, title: "Problem Set 5", max_points: 10, grading_category: 12, grading_period: 9001 },
        ],
      });
    }
    if (path === "/sections/7002/assignments") return json({ assignment: [{ id: 601, title: "Personal narrative", max_points: 50, grading_category: 21, grading_period: 9002 }] });
    if (path === "/sections/7001/grading_categories") return json({ grading_category: [{ id: 11, title: "Tests", weight: 60 }, { id: 12, title: "Homework", weight: 40 }] });
    if (path === "/sections/7002/grading_categories") return json({ grading_category: [{ id: 21, title: "Essays", weight: 0 }] });
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({ server, state, base })));
}
