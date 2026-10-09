/**
 * Pure security and routing decisions for the background worker. Kept free of
 * chrome.* calls so they can be unit tested.
 */
import { isAllowedOrigin } from "@klar/core/protocol";

export interface SenderLike {
  id?: string;
  origin?: string;
  url?: string;
  frameId?: number;
  tab?: { id?: number };
}

function originOf(sender: SenderLike): string | null {
  if (sender.origin) return sender.origin;
  if (!sender.url) return null;
  try {
    return new URL(sender.url).origin;
  } catch {
    return null;
  }
}

/** A message relayed by our bridge script from an allow-listed Klar page. */
export function isTrustedAppSender(sender: SenderLike, runtimeId: string, appOrigins: readonly string[]): boolean {
  if (sender.id !== runtimeId) return false;
  if (!sender.tab || typeof sender.tab.id !== "number") return false;
  if (sender.frameId !== 0) return false;
  return isAllowedOrigin(originOf(sender), appOrigins);
}

/** A report from our gradebook reader on the student's consented Schoology host. */
export function isTrustedSchoologySender(sender: SenderLike, runtimeId: string, consentedHost: string | null): boolean {
  if (!consentedHost) return false;
  if (sender.id !== runtimeId) return false;
  if (!sender.tab || typeof sender.tab.id !== "number" || sender.frameId !== 0) return false;
  const origin = originOf(sender);
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.hostname === consentedHost && !u.port;
  } catch {
    return false;
  }
}

export type TabLocation =
  /** On the student gradebook page. */
  | "grades"
  /** On the school's Schoology site, but on a sign-in page. */
  | "login"
  /** On the school's Schoology site, signed in, some other page. */
  | "host_other"
  /** Somewhere else (usually the school's identity provider). URL hidden from us. */
  | "elsewhere";

export const GRADES_PATH = "/grades/grades";

/**
 * Classify where the sync tab currently is. We only ever see URLs on hosts we
 * have permission for; identity-provider URLs arrive as undefined.
 */
export function classifyTabUrl(url: string | undefined, host: string): TabLocation {
  if (!url) return "elsewhere";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "elsewhere";
  }
  if (u.hostname !== host) return "elsewhere";
  if (/^\/(login|user\/login|saml|sso|register)(\/|$)/i.test(u.pathname)) return "login";
  if (u.pathname.startsWith(GRADES_PATH)) return "grades";
  return "host_other";
}

/** Match pattern for a host, used for permissions and dynamic content scripts. */
export function hostPattern(host: string): string {
  return `https://${host}/*`;
}
