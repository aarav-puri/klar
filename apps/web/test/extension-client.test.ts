import { APP_SOURCE, EXT_SOURCE, PROTOCOL_VERSION } from "@klar/core/protocol";
import { describe, expect, it } from "vitest";
import { callExtension, detectExtension, type ExtensionWindow } from "@/lib/extension-client";

/** A fake window with an optional fake bridge attached. */
function fakeWindow(opts: { installed: boolean; reply?: (req: { id: string; request: { type: string } }) => unknown; spoof?: boolean }) {
  const listeners = new Set<(e: MessageEvent) => void>();
  const win: ExtensionWindow & { sent: unknown[] } = {
    sent: [],
    location: { origin: "https://klar.app" },
    document: { documentElement: { dataset: opts.installed ? { klarExtension: "0.1.0" } : {} } },
    postMessage(message, targetOrigin) {
      win.sent.push({ message, targetOrigin });
      const m = message as { source?: string; id: string; request: { type: string } };
      if (m.source !== APP_SOURCE || !opts.installed) return;
      queueMicrotask(() => {
        const data = opts.reply ? opts.reply(m) : { source: EXT_SOURCE, version: PROTOCOL_VERSION, id: m.id, result: { ok: true, data: { version: "0.1.0" } } };
        if (opts.spoof) {
          // A message from another frame/origin must be ignored.
          for (const l of listeners) l({ source: {}, origin: "https://evil.example", data } as unknown as MessageEvent);
          return;
        }
        for (const l of listeners) l({ source: win, origin: "https://klar.app", data } as unknown as MessageEvent);
      });
    },
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
  };
  return win;
}

describe("extension detection and messaging", () => {
  it("detects an installed extension", async () => {
    expect(await detectExtension(fakeWindow({ installed: true }), 200)).toBe("0.1.0");
  });

  it("reports NOT_INSTALLED when nothing answers", async () => {
    const r = await callExtension({ type: "PING" }, { win: fakeWindow({ installed: false }), timeoutMs: 50 });
    expect(r).toEqual({ ok: false, error: { code: "NOT_INSTALLED", message: expect.any(String) } });
  });

  it("posts only to its own origin", async () => {
    const win = fakeWindow({ installed: true });
    await callExtension({ type: "PING" }, { win, timeoutMs: 200 });
    expect((win.sent[0] as { targetOrigin: string }).targetOrigin).toBe("https://klar.app");
  });

  it("ignores replies from other origins", async () => {
    const r = await callExtension({ type: "PING" }, { win: fakeWindow({ installed: true, spoof: true }), timeoutMs: 60 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TIMEOUT");
  });

  it("ignores replies with the wrong request id", async () => {
    const win = fakeWindow({ installed: true, reply: () => ({ source: EXT_SOURCE, version: PROTOCOL_VERSION, id: "someone-else", result: { ok: true, data: 1 } }) });
    const r = await callExtension({ type: "PING" }, { win, timeoutMs: 60 });
    expect(r.ok).toBe(false);
  });

  it("passes through extension errors", async () => {
    const win = fakeWindow({
      installed: true,
      reply: (m) => ({ source: EXT_SOURCE, version: PROTOCOL_VERSION, id: m.id, result: { ok: false, error: { code: "LOGIN_REQUIRED", message: "Sign in" } } }),
    });
    expect(await callExtension({ type: "SYNC" }, { win, timeoutMs: 200 })).toEqual({ ok: false, error: { code: "LOGIN_REQUIRED", message: "Sign in" } });
  });
});
