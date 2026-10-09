import type { ErrorCode, ExtStatus } from "@klar/core/protocol";
import type { SyncPayloadInput } from "@klar/core/sync";

/**
 * Everything the extension persists. Deliberately small: no credentials,
 * cookies or tokens are ever stored. `pending` holds a sync started from the
 * popup until the web app collects it, then it is deleted.
 */
export interface ExtState {
  host: string | null;
  consentAt: string | null;
  lastSyncAt: string | null;
  lastError: { code: ErrorCode; message: string; at: string } | null;
  pending: SyncPayloadInput | null;
  accountLabel: string | null;
}

export const DEFAULT_STATE: ExtState = {
  host: null,
  consentAt: null,
  lastSyncAt: null,
  lastError: null,
  pending: null,
  accountLabel: null,
};

const KEY = "klar";

export async function readState(): Promise<ExtState> {
  const raw = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_STATE, ...((raw[KEY] as Partial<ExtState> | undefined) ?? {}) };
}

export async function writeState(patch: Partial<ExtState>): Promise<ExtState> {
  const next = { ...(await readState()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export async function clearState(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

export function toStatus(s: ExtState, version: string): ExtStatus {
  return {
    version,
    connected: Boolean(s.host && s.consentAt),
    host: s.host,
    consentAt: s.consentAt,
    lastSyncAt: s.lastSyncAt,
    lastError: s.lastError,
    hasPending: s.pending !== null,
    accountLabel: s.accountLabel,
  };
}
