"use client";
/**
 * Orchestrates a sync from the browser: ask the extension to read the
 * gradebook, send the result to Klar's API, then report back so the
 * extension can show its own status.
 */
import type { SyncPayloadInput } from "@klar/core";
import type { ExtProgress } from "@klar/core/protocol";
import { callExtension, type ClientErrorCode } from "./extension-client";

export type SyncErrorCode =
  | ClientErrorCode
  | "SIGNED_OUT"
  | "NETWORK"
  | "HOST_MISMATCH"
  | "NOT_CONNECTED"
  | "INVALID_PAYLOAD"
  | "RATE_LIMITED"
  | "SERVER";

export interface SyncSummary {
  courses: number;
  assignments: number;
  changes: number;
  syncedAt: string;
}

export type SyncOutcome = { ok: true; summary: SyncSummary } | { ok: false; code: SyncErrorCode; message: string };

export async function ingest(payload: SyncPayloadInput, connect: boolean): Promise<SyncOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/sync/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, ...(connect ? { connect: { consent: true } } : {}) }),
    });
  } catch {
    return { ok: false, code: "NETWORK", message: "You're offline. Try again once you're connected." };
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } & Partial<SyncSummary>;
  if (!res.ok) {
    const code = (body?.error?.code as SyncErrorCode) ?? "SERVER";
    return { ok: false, code, message: body?.error?.message ?? "Klar couldn't save this sync." };
  }
  return { ok: true, summary: body as SyncSummary };
}

export async function runExtensionSync(
  mode: { kind: "connect"; host: string } | { kind: "sync" },
  onProgress?: (p: ExtProgress["progress"]) => void,
): Promise<SyncOutcome> {
  const request = mode.kind === "connect" ? ({ type: "CONNECT", host: mode.host, consent: true } as const) : ({ type: "SYNC" } as const);
  // Sign-in can take a while; the extension enforces its own 5 minute limit.
  const r = await callExtension<{ payload: SyncPayloadInput }>(request, { timeoutMs: 6 * 60_000, onProgress });
  if (!r.ok) return { ok: false, code: r.error.code, message: r.error.message };
  onProgress?.({ stage: "done", message: "Saving to Klar" });
  const out = await ingest(r.data.payload, mode.kind === "connect");
  if (out.ok) {
    void callExtension({ type: "REPORT_RESULT", syncedAt: out.summary.syncedAt });
  }
  return out;
}

/** Collect a capture the extension made while the student browsed Schoology. */
export async function collectPending(): Promise<SyncOutcome | null> {
  const r = await callExtension<{ payload: SyncPayloadInput | null }>({ type: "TAKE_PENDING" }, { timeoutMs: 2_000 });
  if (!r.ok || !r.data.payload) return null;
  const out = await ingest(r.data.payload, false);
  if (out.ok) void callExtension({ type: "REPORT_RESULT", syncedAt: out.summary.syncedAt });
  return out;
}

export async function runOfficialSync(): Promise<SyncOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/sync/official", { method: "POST" });
  } catch {
    return { ok: false, code: "NETWORK", message: "You appear to be offline." };
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } & Partial<SyncSummary>;
  if (!res.ok) return { ok: false, code: (body?.error?.code as SyncErrorCode) ?? "SERVER", message: body?.error?.message ?? "Sync failed." };
  return { ok: true, summary: body as SyncSummary };
}
