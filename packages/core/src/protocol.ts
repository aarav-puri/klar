/**
 * Messaging contract between the Klar web app and the companion extension.
 *
 * Transport: the web page talks to an extension "bridge" content script with
 * window.postMessage. The bridge validates every message, then relays it to
 * the background service worker, which validates the sender again. Nothing in
 * this protocol carries Schoology cookies, passwords or session tokens; the
 * only payload that crosses is grade data the student chose to share.
 */

import type { SyncPayload } from "./sync";

export const APP_SOURCE = "klar-app" as const;
export const EXT_SOURCE = "klar-ext" as const;
export const PROTOCOL_VERSION = 1;

export type AppRequest =
  | { type: "PING" }
  | { type: "GET_STATUS" }
  /** Records consent for a Schoology host, then signs in (if needed) and syncs. */
  | { type: "CONNECT"; host: string; consent: true }
  | { type: "SYNC" }
  /** Hand over grade data captured while the student browsed Schoology. */
  | { type: "TAKE_PENDING" }
  | { type: "REPORT_RESULT"; syncedAt: string }
  | { type: "DISCONNECT" };

export type AppRequestType = AppRequest["type"];

export interface AppEnvelope {
  source: typeof APP_SOURCE;
  version: number;
  id: string;
  request: AppRequest;
}

export type ErrorCode =
  | "CONSENT_REQUIRED"
  | "HOST_INVALID"
  | "PERMISSION_DENIED"
  | "LOGIN_REQUIRED"
  | "LOGIN_TIMEOUT"
  | "TAB_CLOSED"
  | "PARSE_FAILED"
  | "NO_COURSES"
  | "BUSY"
  | "NOT_CONNECTED"
  | "ORIGIN_REJECTED"
  | "INTERNAL";

export interface ExtStatus {
  version: string;
  connected: boolean;
  host: string | null;
  consentAt: string | null;
  lastSyncAt: string | null;
  lastError: { code: ErrorCode; message: string; at: string } | null;
  hasPending: boolean;
  /** Display-only details read from the gradebook page header, never credentials. */
  accountLabel: string | null;
}

export type ExtResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: ErrorCode; message: string } };

export interface ExtEnvelope {
  source: typeof EXT_SOURCE;
  version: number;
  id: string;
  result: ExtResult;
}

/** Progress events pushed from the extension while a sync is running. */
export interface ExtProgress {
  source: typeof EXT_SOURCE;
  version: number;
  progress: {
    stage: "opening" | "waiting_for_login" | "reading" | "done";
    message: string;
  };
}

export type SyncResultData = { payload: SyncPayload };

/* ------------------------------------------------------------------------ */
/* Validation                                                               */
/* ------------------------------------------------------------------------ */

const REQUEST_TYPES: ReadonlySet<string> = new Set<AppRequestType>([
  "PING",
  "GET_STATUS",
  "CONNECT",
  "SYNC",
  "TAKE_PENDING",
  "REPORT_RESULT",
  "DISCONNECT",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Structural validation of a request coming from the web page. */
export function parseAppEnvelope(data: unknown): AppEnvelope | null {
  if (!isRecord(data)) return null;
  if (data.source !== APP_SOURCE) return null;
  if (data.version !== PROTOCOL_VERSION) return null;
  if (typeof data.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(data.id)) return null;
  const req = data.request;
  if (!isRecord(req) || typeof req.type !== "string" || !REQUEST_TYPES.has(req.type)) return null;

  switch (req.type) {
    case "CONNECT": {
      if (req.consent !== true) return null;
      if (typeof req.host !== "string") return null;
      const host = normalizeSchoologyHost(req.host);
      if (!host) return null;
      return { source: APP_SOURCE, version: PROTOCOL_VERSION, id: data.id, request: { type: "CONNECT", host, consent: true } };
    }
    case "REPORT_RESULT": {
      if (typeof req.syncedAt !== "string" || Number.isNaN(Date.parse(req.syncedAt))) return null;
      return { source: APP_SOURCE, version: PROTOCOL_VERSION, id: data.id, request: { type: "REPORT_RESULT", syncedAt: req.syncedAt } };
    }
    default:
      return {
        source: APP_SOURCE,
        version: PROTOCOL_VERSION,
        id: data.id,
        request: { type: req.type as Exclude<AppRequestType, "CONNECT" | "REPORT_RESULT"> } as AppRequest,
      };
  }
}

export function parseExtEnvelope(data: unknown, expectedId: string): ExtEnvelope | null {
  if (!isRecord(data)) return null;
  if (data.source !== EXT_SOURCE || data.version !== PROTOCOL_VERSION) return null;
  if (data.id !== expectedId) return null;
  const r = data.result;
  if (!isRecord(r) || typeof r.ok !== "boolean") return null;
  if (!r.ok) {
    const e = r.error;
    if (!isRecord(e) || typeof e.code !== "string" || typeof e.message !== "string") return null;
  }
  return data as unknown as ExtEnvelope;
}

/**
 * Exact origin allow-list check. Only scheme + host + port are compared, and
 * opaque origins ("null") are always rejected.
 */
export function isAllowedOrigin(origin: string | undefined | null, allowList: readonly string[]): boolean {
  if (!origin || origin === "null") return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== origin.replace(/\/$/, "")) return false;
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(isLocal && parsed.protocol === "http:")) return false;
  return allowList.some((allowed) => {
    try {
      return new URL(allowed).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Accepts "lincoln.schoology.com", "https://lincoln.schoology.com/home" etc.
 * and returns a bare lowercase hostname, or null if it is not a plausible
 * public hostname. Ports, credentials and IP literals are rejected.
 */
export function normalizeSchoologyHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed.length > 300) return null;
  let candidate = trimmed;
  if (!/^[a-z]+:\/\//.test(candidate)) candidate = `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname;
  if (!HOSTNAME_RE.test(host)) return null;
  return host;
}

/** Hosts covered by the extension's install-time permission. */
export function isSchoologyDotCom(host: string): boolean {
  return host === "schoology.com" || host.endsWith(".schoology.com");
}

export function newRequestId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ERROR_COPY: Record<ErrorCode, { title: string; recovery: string }> = {
  CONSENT_REQUIRED: {
    title: "Permission needed",
    recovery: "Confirm what Klar reads to continue.",
  },
  HOST_INVALID: {
    title: "That's not a Schoology address",
    recovery: "Copy it from your address bar while Schoology is open.",
  },
  PERMISSION_DENIED: {
    title: "Chrome didn't allow access to your school's site",
    recovery: "Press Connect again and choose Allow. Klar only asks for that one site.",
  },
  LOGIN_REQUIRED: {
    title: "Sign in to Schoology to continue",
    recovery: "Finish signing in on the Schoology tab.",
  },
  LOGIN_TIMEOUT: {
    title: "Sign-in took too long",
    recovery: "Sign in to Schoology, then try again.",
  },
  TAB_CLOSED: {
    title: "The Schoology tab was closed",
    recovery: "Try again and keep the tab open until it finishes.",
  },
  PARSE_FAILED: {
    title: "Klar couldn't read your grades",
    recovery: "Open Grades in Schoology to check they're visible, then try again.",
  },
  NO_COURSES: {
    title: "No graded courses found",
    recovery: "Once your school posts grades, sync again.",
  },
  BUSY: { title: "A sync is already running", recovery: "Wait a moment for it to finish." },
  NOT_CONNECTED: {
    title: "Schoology isn't connected yet",
    recovery: "Connect it in Settings.",
  },
  ORIGIN_REJECTED: {
    title: "This page isn't allowed to talk to the extension",
    recovery: "Open Klar from its official address.",
  },
  INTERNAL: { title: "Something went wrong", recovery: "Try again. If it keeps happening, reload the extension." },
};
