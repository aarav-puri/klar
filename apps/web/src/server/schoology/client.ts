import "server-only";
import { mapApiBundle, type ApiAssignment, type ApiCategory, type ApiSection, type ApiSectionGrades } from "@klar/core/schoology-api";
import type { SyncPayloadInput } from "@klar/core";
import { env } from "../env";
import { authorizationHeader, parseTokenResponse } from "./oauth";

export class SchoologyApiError extends Error {
  constructor(
    public code: "UNAUTHORIZED" | "FORBIDDEN" | "UNAVAILABLE" | "NOT_CONFIGURED" | "BAD_RESPONSE",
    message: string,
  ) {
    super(message);
  }
}

const consumer = () => {
  if (!env.schoologyKey || !env.schoologySecret) throw new SchoologyApiError("NOT_CONFIGURED", "Schoology API keys are not configured.");
  return { consumerKey: env.schoologyKey, consumerSecret: env.schoologySecret };
};

async function call(url: string, token?: { token: string; secret: string }, init: { method?: string } = {}): Promise<Response> {
  const method = init.method ?? "GET";
  const auth = authorizationHeader(method, url, { ...consumer(), token: token?.token, tokenSecret: token?.secret });
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { Authorization: auth, Accept: "application/json" }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new SchoologyApiError("UNAVAILABLE", "Schoology did not respond.");
  }
  if (res.status === 401) throw new SchoologyApiError("UNAUTHORIZED", "Schoology rejected the saved authorization.");
  if (res.status === 403) throw new SchoologyApiError("FORBIDDEN", "Your school does not allow this access.");
  if (res.status >= 500) throw new SchoologyApiError("UNAVAILABLE", "Schoology is having trouble right now.");
  return res;
}

export async function getRequestToken() {
  const res = await call(`${env.schoologyApiBase}/oauth/request_token`);
  const t = res.ok ? parseTokenResponse(await res.text()) : null;
  if (!t) throw new SchoologyApiError("BAD_RESPONSE", "Could not start Schoology authorization.");
  return t;
}

export async function getAccessToken(request: { token: string; secret: string }) {
  const res = await call(`${env.schoologyApiBase}/oauth/access_token`, request);
  const t = res.ok ? parseTokenResponse(await res.text()) : null;
  if (!t) throw new SchoologyApiError("UNAUTHORIZED", "Schoology did not grant access.");
  return t;
}

/** The authorize page lives on the school's own Schoology host. */
export function authorizeUrl(host: string, requestToken: string, callback: string): string {
  const u = new URL(`https://${host}/oauth/authorize`);
  u.searchParams.set("oauth_token", requestToken);
  u.searchParams.set("oauth_callback", callback);
  return u.toString();
}

async function getJson<T>(path: string, token: { token: string; secret: string }): Promise<T> {
  let url = `${env.schoologyApiBase}${path}`;
  let res = await call(url, token);
  // /users/me answers with a 303 to /users/{id}; follow it with a fresh signature.
  if (res.status === 303 || res.status === 302) {
    const loc = res.headers.get("location");
    if (!loc) throw new SchoologyApiError("BAD_RESPONSE", "Unexpected redirect.");
    url = new URL(loc, env.schoologyApiBase).toString();
    if (!url.startsWith(env.schoologyApiBase)) throw new SchoologyApiError("BAD_RESPONSE", "Unexpected redirect target.");
    res = await call(url, token);
  }
  if (!res.ok) throw new SchoologyApiError("BAD_RESPONSE", `Schoology returned ${res.status}.`);
  return (await res.json()) as T;
}

export async function verifyAccess(token: { token: string; secret: string }) {
  const me = await getJson<{ uid?: string | number; id?: string | number; name_display?: string }>("/users/me", token);
  const uid = String(me.uid ?? me.id ?? "");
  if (!uid) throw new SchoologyApiError("BAD_RESPONSE", "Could not read your Schoology account.");
  return { uid, name: me.name_display ?? null };
}

async function paged<T>(path: string, key: string, token: { token: string; secret: string }): Promise<T[]> {
  const out: T[] = [];
  for (let start = 0; start < 2000; start += 200) {
    const sep = path.includes("?") ? "&" : "?";
    const page = await getJson<Record<string, unknown>>(`${path}${sep}start=${start}&limit=200`, token);
    const items = (page[key] as T[] | undefined) ?? [];
    out.push(...items);
    if (items.length < 200) break;
  }
  return out;
}

/** Read-only fetch of everything Klar needs, mapped to a SyncPayload. */
export async function fetchBundle(host: string, uid: string, token: { token: string; secret: string }, accountLabel: string | null): Promise<SyncPayloadInput> {
  const sections = await paged<ApiSection>(`/users/${encodeURIComponent(uid)}/sections`, "section", token);
  const gradesRes = await getJson<{ section?: ApiSectionGrades[] }>(`/users/${encodeURIComponent(uid)}/grades`, token);
  const assignmentsBySection: Record<string, ApiAssignment[]> = {};
  const categoriesBySection: Record<string, ApiCategory[]> = {};
  for (const s of sections.slice(0, 40)) {
    const sid = encodeURIComponent(String(s.id));
    assignmentsBySection[String(s.id)] = await paged<ApiAssignment>(`/sections/${sid}/assignments`, "assignment", token);
    const cats = await getJson<{ grading_category?: ApiCategory[] }>(`/sections/${sid}/grading_categories`, token).catch(() => ({ grading_category: [] }));
    categoriesBySection[String(s.id)] = cats.grading_category ?? [];
  }
  return mapApiBundle({
    host,
    capturedAt: new Date().toISOString(),
    accountLabel,
    sections,
    grades: gradesRes.section ?? [],
    assignmentsBySection,
    categoriesBySection,
  });
}
