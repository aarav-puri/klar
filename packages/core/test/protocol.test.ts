import { describe, expect, it } from "vitest";
import {
  APP_SOURCE,
  EXT_SOURCE,
  isAllowedOrigin,
  isSchoologyDotCom,
  normalizeSchoologyHost,
  parseAppEnvelope,
  parseExtEnvelope,
  PROTOCOL_VERSION,
} from "../src/protocol";

const env = (request: unknown, extra: Record<string, unknown> = {}) => ({
  source: APP_SOURCE,
  version: PROTOCOL_VERSION,
  id: "abcdef123456",
  request,
  ...extra,
});

describe("origin validation", () => {
  const allow = ["https://klar.app", "http://localhost:3000"];
  it("accepts exact allow-listed origins", () => {
    expect(isAllowedOrigin("https://klar.app", allow)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", allow)).toBe(true);
  });
  it("rejects look-alikes, other ports, paths and opaque origins", () => {
    expect(isAllowedOrigin("https://klar.app.evil.com", allow)).toBe(false);
    expect(isAllowedOrigin("https://evil-klar.app", allow)).toBe(false);
    expect(isAllowedOrigin("http://klar.app", allow)).toBe(false);
    expect(isAllowedOrigin("http://localhost:3001", allow)).toBe(false);
    expect(isAllowedOrigin("https://klar.app/path", allow)).toBe(false);
    expect(isAllowedOrigin("null", allow)).toBe(false);
    expect(isAllowedOrigin(undefined, allow)).toBe(false);
    expect(isAllowedOrigin("javascript:alert(1)", allow)).toBe(false);
  });
  it("rejects plain http for non-local hosts even if listed", () => {
    expect(isAllowedOrigin("http://klar.app", ["http://klar.app"])).toBe(false);
  });
});

describe("app envelope parsing", () => {
  it("accepts well-formed requests", () => {
    expect(parseAppEnvelope(env({ type: "PING" }))?.request.type).toBe("PING");
    const c = parseAppEnvelope(env({ type: "CONNECT", host: "https://Lincoln.Schoology.com/home", consent: true }));
    expect(c?.request).toEqual({ type: "CONNECT", host: "lincoln.schoology.com", consent: true });
  });
  it("rejects missing consent, bad hosts, unknown types and wrong sources", () => {
    expect(parseAppEnvelope(env({ type: "CONNECT", host: "lincoln.schoology.com" }))).toBeNull();
    expect(parseAppEnvelope(env({ type: "CONNECT", host: "javascript:alert(1)", consent: true }))).toBeNull();
    expect(parseAppEnvelope(env({ type: "STEAL_COOKIES" }))).toBeNull();
    expect(parseAppEnvelope({ ...env({ type: "PING" }), source: EXT_SOURCE })).toBeNull();
    expect(parseAppEnvelope({ ...env({ type: "PING" }), version: 99 })).toBeNull();
    expect(parseAppEnvelope({ ...env({ type: "PING" }), id: "<script>" })).toBeNull();
    expect(parseAppEnvelope("PING")).toBeNull();
    expect(parseAppEnvelope(null)).toBeNull();
  });
  it("strips unexpected fields", () => {
    const r = parseAppEnvelope(env({ type: "SYNC", cookie: "x" }));
    expect(r?.request).toEqual({ type: "SYNC" });
  });
  it("validates REPORT_RESULT timestamps", () => {
    expect(parseAppEnvelope(env({ type: "REPORT_RESULT", syncedAt: "2026-10-08T10:00:00Z" }))?.request).toEqual({ type: "REPORT_RESULT", syncedAt: "2026-10-08T10:00:00Z" });
    expect(parseAppEnvelope(env({ type: "REPORT_RESULT", syncedAt: "nope" }))).toBeNull();
  });
});

describe("extension envelope parsing", () => {
  it("only accepts replies to the pending request id", () => {
    const reply = { source: EXT_SOURCE, version: PROTOCOL_VERSION, id: "abcdef123456", result: { ok: true, data: {} } };
    expect(parseExtEnvelope(reply, "abcdef123456")).not.toBeNull();
    expect(parseExtEnvelope(reply, "other-id-0000")).toBeNull();
    expect(parseExtEnvelope({ ...reply, result: { ok: false } }, "abcdef123456")).toBeNull();
  });
});

describe("schoology hosts", () => {
  it("normalizes user input", () => {
    expect(normalizeSchoologyHost("app.schoology.com")).toBe("app.schoology.com");
    expect(normalizeSchoologyHost("  https://LMS.District.org/grades/grades ")).toBe("lms.district.org");
  });
  it("rejects unsafe or malformed input", () => {
    expect(normalizeSchoologyHost("http://app.schoology.com")).toBeNull();
    expect(normalizeSchoologyHost("https://user:pw@app.schoology.com")).toBeNull();
    expect(normalizeSchoologyHost("app.schoology.com:8443")).toBeNull();
    expect(normalizeSchoologyHost("192.168.0.1")).toBeNull();
    expect(normalizeSchoologyHost("localhost")).toBeNull();
    expect(normalizeSchoologyHost("")).toBeNull();
  });
  it("knows which hosts are covered by install-time permission", () => {
    expect(isSchoologyDotCom("lincoln.schoology.com")).toBe(true);
    expect(isSchoologyDotCom("schoology.com.evil.net")).toBe(false);
    expect(isSchoologyDotCom("notschoology.com")).toBe(false);
  });
});
