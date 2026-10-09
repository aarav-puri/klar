/**
 * Web-page side of the extension protocol. Talks to the bridge content script
 * through window.postMessage and only accepts replies from this window, this
 * origin, with the exact request id it sent.
 */
import {
  APP_SOURCE,
  EXT_SOURCE,
  newRequestId,
  parseExtEnvelope,
  PROTOCOL_VERSION,
  type AppRequest,
  type ErrorCode,
  type ExtProgress,
  type ExtResult,
} from "@klar/core/protocol";

export type ClientErrorCode = ErrorCode | "NOT_INSTALLED" | "TIMEOUT";
export type ClientResult<T> = { ok: true; data: T } | { ok: false; error: { code: ClientErrorCode; message: string } };

export interface ExtensionWindow {
  location: { origin: string };
  document: { documentElement: { dataset: DOMStringMap } };
  postMessage(message: unknown, targetOrigin: string): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (e: MessageEvent) => void): void;
}

const browserWindow = () => window as unknown as ExtensionWindow;

/** Synchronous hint set by the bridge at document_start. */
export function extensionMarker(win: ExtensionWindow = browserWindow()): string | null {
  return win.document.documentElement.dataset.klarExtension ?? null;
}

export function callExtension<T = unknown>(
  request: AppRequest,
  opts: { timeoutMs?: number; onProgress?: (p: ExtProgress["progress"]) => void; win?: ExtensionWindow } = {},
): Promise<ClientResult<T>> {
  const win = opts.win ?? browserWindow();
  const id = newRequestId();
  const timeoutMs = opts.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    const done = (r: ClientResult<T>) => {
      win.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(r);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== (win as unknown) || e.origin !== win.location.origin) return;
      const data = e.data as { source?: string; progress?: ExtProgress["progress"] } | null;
      if (data?.source === EXT_SOURCE && data.progress && opts.onProgress) {
        opts.onProgress(data.progress);
        return;
      }
      const env = parseExtEnvelope(e.data, id);
      if (!env) return;
      done(env.result as ExtResult as ClientResult<T>);
    };
    const timer = setTimeout(
      () =>
        done({
          ok: false,
          error: extensionMarker(win)
            ? { code: "TIMEOUT", message: "The extension didn't respond in time." }
            : { code: "NOT_INSTALLED", message: "The Klar extension isn't installed or is turned off." },
        }),
      timeoutMs,
    );
    win.addEventListener("message", onMessage);
    win.postMessage({ source: APP_SOURCE, version: PROTOCOL_VERSION, id, request }, win.location.origin);
  });
}

/** Resolves with the extension version, or null when it is absent or disabled. */
export async function detectExtension(win: ExtensionWindow = browserWindow(), timeoutMs = 900): Promise<string | null> {
  const r = await callExtension<{ version: string }>({ type: "PING" }, { timeoutMs, win });
  return r.ok ? r.data.version : null;
}

/** Subscribe to "new capture available" pushes from the extension. */
export function onPendingAvailable(handler: () => void, win: ExtensionWindow = browserWindow()): () => void {
  const listener = (e: MessageEvent) => {
    if (e.source !== (win as unknown) || e.origin !== win.location.origin) return;
    const d = e.data as { source?: string; version?: number; type?: string } | null;
    if (d?.source === EXT_SOURCE && d.version === PROTOCOL_VERSION && d.type === "pending_available") handler();
  };
  win.addEventListener("message", listener);
  return () => win.removeEventListener("message", listener);
}
