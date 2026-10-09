/**
 * Klar background service worker.
 *
 * Responsibilities:
 *  - Answer requests relayed from Klar web pages (validated twice: by the
 *    bridge script, and here against the sender's origin).
 *  - Run a user-initiated sync: open the student's Schoology gradebook in a
 *    tab, let Schoology and the school's sign-in handle authentication, and
 *    collect what the gradebook reader extracts.
 *  - Keep a tiny amount of state (host, consent time, last sync).
 *
 * It never reads cookies, never sees passwords, and never sends anything to a
 * server itself. Grade data is handed only to an allow-listed Klar page.
 */
import {
  ERROR_COPY,
  EXT_SOURCE,
  isSchoologyDotCom,
  parseAppEnvelope,
  PROTOCOL_VERSION,
  type AppRequest,
  type ErrorCode,
  type ExtEnvelope,
  type ExtProgress,
  type ExtResult,
} from "@klar/core/protocol";
import type { ParseOutcome } from "@klar/core/schoology-dom";
import type { SyncPayloadInput } from "@klar/core/sync";
import { classifyTabUrl, GRADES_PATH, hostPattern, isTrustedAppSender, isTrustedSchoologySender } from "./lib/policy";
import { clearState, readState, toStatus, writeState } from "./lib/storage";

const VERSION = __EXT_VERSION__;
const APP_ORIGINS = __APP_ORIGINS__;
const CUSTOM_SCRIPT_ID = "klar-capture-custom";

const LOAD_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;

class SyncError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message ?? ERROR_COPY[code].title);
  }
}

/* ------------------------------------------------------------------------ */
/* Sync orchestration                                                       */
/* ------------------------------------------------------------------------ */

interface ActiveSync {
  tabId: number;
  host: string;
  requesterTabId: number | null;
  waitingForLogin: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (p: SyncPayloadInput) => void;
  reject: (e: SyncError) => void;
}

let active: ActiveSync | null = null;

function arm(ms: number, code: ErrorCode) {
  if (!active) return;
  if (active.timer) clearTimeout(active.timer);
  active.timer = setTimeout(() => finish(new SyncError(code)), ms);
}

async function finish(result: SyncPayloadInput | SyncError) {
  const current = active;
  if (!current) return;
  active = null;
  if (current.timer) clearTimeout(current.timer);
  // Close the tab we opened (unless the student already did), then return
  // them to Klar. Chrome throws synchronously on invalid ids, so guard first.
  if (current.tabId >= 0) chrome.tabs.remove(current.tabId).catch(() => undefined);
  if (current.requesterTabId !== null) {
    chrome.tabs.update(current.requesterTabId, { active: true }).catch(() => undefined);
  }
  if (result instanceof SyncError) {
    await writeState({ lastError: { code: result.code, message: result.message, at: new Date().toISOString() } });
    current.reject(result);
  } else {
    await writeState({ lastError: null, accountLabel: result.accountLabel ?? null });
    current.resolve(result);
  }
}

async function hasHostAccess(host: string): Promise<boolean> {
  return chrome.permissions.contains({ origins: [hostPattern(host)] });
}

function sendProgress(tabId: number | null, progress: ExtProgress["progress"]) {
  if (tabId === null) return;
  const msg: ExtProgress = { source: EXT_SOURCE, version: PROTOCOL_VERSION, progress };
  chrome.tabs.sendMessage(tabId, { kind: "ext-event", event: msg }).catch(() => undefined);
}

async function runSync(host: string, requesterTabId: number | null): Promise<SyncPayloadInput> {
  if (active) throw new SyncError("BUSY");
  if (!(await hasHostAccess(host))) throw new SyncError("PERMISSION_DENIED");

  sendProgress(requesterTabId, { stage: "opening", message: "Opening your Schoology gradebook" });
  const tab = await chrome.tabs.create({ url: `https://${host}${GRADES_PATH}`, active: false });
  if (typeof tab.id !== "number") throw new SyncError("INTERNAL");

  return new Promise<SyncPayloadInput>((resolve, reject) => {
    active = { tabId: tab.id!, host, requesterTabId, waitingForLogin: false, timer: null, resolve, reject };
    arm(LOAD_TIMEOUT_MS, "PARSE_FAILED");
  });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!active || tabId !== active.tabId) return;
  if (info.status !== "complete" && !info.url) return;
  const where = classifyTabUrl(tab.url, active.host);

  if (where === "login" || where === "elsewhere") {
    if (!active.waitingForLogin) {
      active.waitingForLogin = true;
      // Sign-in needs the student, so bring the tab forward.
      chrome.tabs.update(tabId, { active: true }).catch(() => undefined);
      if (typeof tab.windowId === "number") chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
      sendProgress(active.requesterTabId, {
        stage: "waiting_for_login",
        message: "Sign in to Schoology in the tab that just opened",
      });
    }
    arm(LOGIN_TIMEOUT_MS, "LOGIN_TIMEOUT");
    return;
  }

  if (where === "host_other" && info.status === "complete") {
    // Signed in but Schoology sent us to the home page; continue to grades.
    chrome.tabs.update(tabId, { url: `https://${active.host}${GRADES_PATH}` }).catch(() => undefined);
    arm(LOAD_TIMEOUT_MS, "PARSE_FAILED");
    return;
  }

  if (where === "grades") {
    sendProgress(active.requesterTabId, { stage: "reading", message: "Reading your gradebook" });
    arm(LOAD_TIMEOUT_MS, "PARSE_FAILED");
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (active && tabId === active.tabId) {
    // The tab is already gone; avoid trying to close it again.
    active.tabId = -1;
    void finish(new SyncError("TAB_CLOSED"));
  }
});


/* ------------------------------------------------------------------------ */
/* Gradebook reader (content script) messages                               */
/* ------------------------------------------------------------------------ */

/** The reader only ever runs in the tab a sync opened, never when the student browses Schoology. */
async function onCaptureHello(sender: chrome.runtime.MessageSender): Promise<{ read: boolean }> {
  const state = await readState();
  if (!isTrustedSchoologySender(sender, chrome.runtime.id, state.consentAt ? state.host : null)) return { read: false };
  return { read: active !== null && sender.tab?.id === active.tabId };
}

async function onCaptureResult(sender: chrome.runtime.MessageSender, outcome: ParseOutcome) {
  const state = await readState();
  if (!isTrustedSchoologySender(sender, chrome.runtime.id, state.consentAt ? state.host : null)) return;
  if (active === null || sender.tab?.id !== active.tabId) return;
  if (outcome.ok) return void finish(outcome.payload);
  if (outcome.reason === "login") return; // tabs.onUpdated handles sign-in
  return void finish(new SyncError(outcome.reason === "no_courses" ? "NO_COURSES" : "PARSE_FAILED"));
}

async function notifyAppTabs(event: { type: "pending_available" }) {
  const tabs = await chrome.tabs.query({ url: APP_ORIGINS.map((o) => `${o}/*`) });
  for (const t of tabs) {
    if (typeof t.id === "number") {
      chrome.tabs
        .sendMessage(t.id, { kind: "ext-event", event: { source: EXT_SOURCE, version: PROTOCOL_VERSION, ...event } })
        .catch(() => undefined);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* App requests                                                             */
/* ------------------------------------------------------------------------ */

async function ensureCustomHostScript(host: string) {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
  if (isSchoologyDotCom(host)) return; // covered by the static content script
  if (!(await hasHostAccess(host))) return;
  await chrome.scripting.registerContentScripts([
    {
      id: CUSTOM_SCRIPT_ID,
      matches: [`https://${host}${GRADES_PATH}*`],
      js: ["capture.js"],
      runAt: "document_idle",
      persistAcrossSessions: true,
    },
  ]);
}

async function handleAppRequest(req: AppRequest, tabId: number): Promise<unknown> {
  const state = await readState();
  switch (req.type) {
    case "PING":
      return { version: VERSION, protocol: PROTOCOL_VERSION };

    case "GET_STATUS":
      return toStatus(state, VERSION);

    case "CONNECT": {
      if (!isSchoologyDotCom(req.host) && !(await hasHostAccess(req.host))) {
        // Optional host permissions can only be granted from an extension
        // page with a user gesture, so open a small approval page.
        await chrome.tabs.create({ url: chrome.runtime.getURL(`popup.html?grant=${encodeURIComponent(req.host)}`) });
        throw new SyncError(
          "PERMISSION_DENIED",
          `Approve access to ${req.host} in the tab that just opened, then press Try again.`,
        );
      }
      if (state.host && state.host !== req.host) await writeState({ pending: null });
      await writeState({ host: req.host, consentAt: new Date().toISOString(), lastError: null });
      await ensureCustomHostScript(req.host);
      return { payload: await runSync(req.host, tabId) };
    }

    case "SYNC": {
      if (!state.host || !state.consentAt) throw new SyncError("NOT_CONNECTED");
      return { payload: await runSync(state.host, tabId) };
    }

    case "TAKE_PENDING": {
      if (!state.pending || state.pending.schoologyHost !== state.host) return { payload: null };
      await writeState({ pending: null });
      return { payload: state.pending };
    }

    case "REPORT_RESULT": {
      await writeState({ lastSyncAt: req.syncedAt, lastError: null });
      await updateBadge();
      return { ok: true };
    }

    case "DISCONNECT": {
      await disconnect();
      return { ok: true };
    }
  }
}

async function disconnect() {
  const state = await readState();
  await chrome.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] }).catch(() => undefined);
  if (state.host && !isSchoologyDotCom(state.host)) {
    await chrome.permissions.remove({ origins: [hostPattern(state.host)] }).catch(() => undefined);
  }
  await clearState();
  await updateBadge();
}

async function updateBadge() {
  const s = await readState();
  const needsAttention = s.lastError && ["LOGIN_TIMEOUT", "PERMISSION_DENIED", "PARSE_FAILED"].includes(s.lastError.code);
  await chrome.action.setBadgeText({ text: needsAttention ? "!" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#D94D55" });
}

/* ------------------------------------------------------------------------ */
/* Message router                                                           */
/* ------------------------------------------------------------------------ */

type InternalMessage =
  | { kind: "app-request"; envelope: unknown }
  | { kind: "capture-hello" }
  | { kind: "capture-result"; outcome: ParseOutcome }
  | { kind: "popup"; action: "status" | "disconnect" | "granted"; host?: string };

function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && typeof sender.url === "string" && sender.url.startsWith(chrome.runtime.getURL(""));
}

chrome.runtime.onMessage.addListener((message: InternalMessage, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.kind === "app-request") {
    if (!isTrustedAppSender(sender, chrome.runtime.id, APP_ORIGINS)) {
      sendResponse(fail("ORIGIN_REJECTED"));
      return false;
    }
    const envelope = parseAppEnvelope(message.envelope);
    if (!envelope) {
      sendResponse(fail("INTERNAL", "Malformed request"));
      return false;
    }
    handleAppRequest(envelope.request, sender.tab!.id!)
      .then((data) => sendResponse(reply(envelope.id, { ok: true, data })))
      .catch((e: unknown) => sendResponse(reply(envelope.id, toFailure(e))));
    return true;
  }

  if (message.kind === "capture-hello") {
    onCaptureHello(sender).then(sendResponse);
    return true;
  }

  if (message.kind === "capture-result") {
    void onCaptureResult(sender, message.outcome);
    return false;
  }

  if (message.kind === "popup" && isExtensionPage(sender)) {
    void handlePopup(message).then(sendResponse, (e: unknown) => sendResponse(toFailure(e)));
    return true;
  }
  return false;
});

async function handlePopup(message: Extract<InternalMessage, { kind: "popup" }>): Promise<unknown> {
  const state = await readState();
  switch (message.action) {
    case "status":
      return { ok: true, data: { ...toStatus(state, VERSION), appUrl: __APP_URL__ } };
    case "disconnect":
      await disconnect();
      return { ok: true, data: null };
    case "granted":
      if (message.host) await ensureCustomHostScript(message.host);
      return { ok: true, data: null };
  }
}

function reply(id: string, result: ExtResult): ExtEnvelope {
  return { source: EXT_SOURCE, version: PROTOCOL_VERSION, id, result };
}

function fail(code: ErrorCode, message?: string): ExtResult {
  return { ok: false, error: { code, message: message ?? ERROR_COPY[code].title } };
}

function toFailure(e: unknown): ExtResult {
  if (e instanceof SyncError) return fail(e.code, e.message);
  console.error("[klar] unexpected error", e);
  return fail("INTERNAL");
}

chrome.runtime.onInstalled.addListener(() => {
  void readState().then((s) => (s.host ? ensureCustomHostScript(s.host) : undefined));
  void updateBadge();
});
