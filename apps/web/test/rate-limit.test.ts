import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/server/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit per window, per key", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.check("a", 0).ok).toBe(true);
    expect(rl.check("a", 10).ok).toBe(true);
    const blocked = rl.check("a", 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(rl.check("b", 20).ok).toBe(true);
    expect(rl.check("a", 1001).ok).toBe(true);
  });
});
