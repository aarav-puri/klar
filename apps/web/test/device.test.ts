import { describe, expect, it } from "vitest";
import { isMobileDevice } from "@/lib/device";

const nav = (userAgent: string, maxTouchPoints = 0, mobile?: boolean) => ({ userAgent, maxTouchPoints, userAgentData: mobile === undefined ? undefined : { mobile } });

describe("isMobileDevice", () => {
  it("blocks phones and tablets", () => {
    expect(isMobileDevice(nav("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1", 5))).toBe(true);
    expect(isMobileDevice(nav("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36", 5))).toBe(true);
    expect(isMobileDevice(nav("Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", 5))).toBe(true);
    expect(isMobileDevice(nav("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/140.0 Mobile/15E148 Safari/604.1", 5))).toBe(true);
    // iPadOS asks for the desktop site and claims to be a Mac.
    expect(isMobileDevice(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", 5))).toBe(true);
    expect(isMobileDevice(nav("anything", 0, true))).toBe(true);
  });

  it("allows computer browsers", () => {
    expect(isMobileDevice(nav("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", 0))).toBe(false);
    expect(isMobileDevice(nav("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0", 10, false))).toBe(false);
    expect(isMobileDevice(nav("Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36", 10))).toBe(false);
  });
});
