import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ env: { tokenKey: randomBytes(32).toString("base64") } }));

const { seal, unseal } = await import("@/server/crypto");

describe("token sealing", () => {
  it("round-trips and uses a fresh IV every time", () => {
    const a = seal("secret-token");
    const b = seal("secret-token");
    expect(a).not.toBe(b);
    expect(a).not.toContain("secret-token");
    expect(unseal(a)).toBe("secret-token");
  });
  it("rejects tampering and wrong keys", () => {
    const s = seal("x");
    const parts = s.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(unseal(parts.join("."))).toBeNull();
    expect(unseal(s, randomBytes(32))).toBeNull();
    expect(unseal("garbage")).toBeNull();
  });
});
