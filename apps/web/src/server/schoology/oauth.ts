/**
 * OAuth 1.0a request signing (RFC 5849) for the Schoology API.
 * HMAC-SHA1, as Schoology recommends for three-legged OAuth.
 */
import { createHmac, randomBytes } from "node:crypto";

export interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  token?: string;
  tokenSecret?: string;
}

/** RFC 3986 percent-encoding, stricter than encodeURIComponent. */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function signatureBaseString(method: string, url: string, params: [string, string][]): string {
  const u = new URL(url);
  const base = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
  const all: [string, string][] = [...params];
  u.searchParams.forEach((v, k) => all.push([k, v]));
  const normalized = all
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return [method.toUpperCase(), percentEncode(base), percentEncode(normalized)].join("&");
}

export function sign(base: string, consumerSecret: string, tokenSecret = ""): string {
  return createHmac("sha1", `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`).update(base).digest("base64");
}

export function authorizationHeader(
  method: string,
  url: string,
  creds: OAuthCredentials,
  extra: Record<string, string> = {},
  fixed?: { nonce: string; timestamp: string },
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: fixed?.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed?.timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    ...(creds.token ? { oauth_token: creds.token } : {}),
    ...extra,
  };
  const base = signatureBaseString(method, url, Object.entries(oauth));
  oauth.oauth_signature = sign(base, creds.consumerSecret, creds.tokenSecret);
  return (
    `OAuth realm="Schoology API", ` +
    Object.entries(oauth)
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}

export function parseTokenResponse(body: string): { token: string; secret: string } | null {
  const p = new URLSearchParams(body);
  const token = p.get("oauth_token");
  const secret = p.get("oauth_token_secret");
  return token && secret ? { token, secret } : null;
}
