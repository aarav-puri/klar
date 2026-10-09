import { describe, expect, it } from "vitest";
import { classifyTabUrl, isTrustedAppSender, isTrustedSchoologySender } from "../src/lib/policy";

const ID = "abcdefghijklmnop";
const ORIGINS = ["http://localhost:3000", "https://klar.app"];

describe("app sender validation", () => {
  const ok = { id: ID, origin: "https://klar.app", frameId: 0, tab: { id: 4 } };
  it("accepts the bridge on an allow-listed top frame", () => {
    expect(isTrustedAppSender(ok, ID, ORIGINS)).toBe(true);
    expect(isTrustedAppSender({ ...ok, origin: undefined, url: "http://localhost:3000/connect" }, ID, ORIGINS)).toBe(true);
  });
  it("rejects other extensions, iframes, missing tabs and foreign origins", () => {
    expect(isTrustedAppSender({ ...ok, id: "other" }, ID, ORIGINS)).toBe(false);
    expect(isTrustedAppSender({ ...ok, frameId: 3 }, ID, ORIGINS)).toBe(false);
    expect(isTrustedAppSender({ ...ok, tab: undefined }, ID, ORIGINS)).toBe(false);
    expect(isTrustedAppSender({ ...ok, origin: "https://klar.app.attacker.io" }, ID, ORIGINS)).toBe(false);
    expect(isTrustedAppSender({ ...ok, origin: "https://lincoln.schoology.com" }, ID, ORIGINS)).toBe(false);
  });
});

describe("schoology sender validation", () => {
  const ok = { id: ID, origin: "https://lincoln.schoology.com", frameId: 0, tab: { id: 9 } };
  it("accepts only the consented host", () => {
    expect(isTrustedSchoologySender(ok, ID, "lincoln.schoology.com")).toBe(true);
    expect(isTrustedSchoologySender(ok, ID, "other.schoology.com")).toBe(false);
    expect(isTrustedSchoologySender(ok, ID, null)).toBe(false);
    expect(isTrustedSchoologySender({ ...ok, origin: "http://lincoln.schoology.com" }, ID, "lincoln.schoology.com")).toBe(false);
    expect(isTrustedSchoologySender({ ...ok, frameId: 1 }, ID, "lincoln.schoology.com")).toBe(false);
  });
});

describe("sync tab routing", () => {
  const host = "lincoln.schoology.com";
  it("classifies where the sync tab is", () => {
    expect(classifyTabUrl("https://lincoln.schoology.com/grades/grades", host)).toBe("grades");
    expect(classifyTabUrl("https://lincoln.schoology.com/login?destination=grades", host)).toBe("login");
    expect(classifyTabUrl("https://lincoln.schoology.com/login/saml/initial", host)).toBe("login");
    expect(classifyTabUrl("https://lincoln.schoology.com/home", host)).toBe("host_other");
    expect(classifyTabUrl(undefined, host)).toBe("elsewhere");
    expect(classifyTabUrl("https://accounts.google.com/o/saml2", host)).toBe("elsewhere");
    expect(classifyTabUrl("https://lincoln.schoology.com.evil.io/grades/grades", host)).toBe("elsewhere");
  });
});
