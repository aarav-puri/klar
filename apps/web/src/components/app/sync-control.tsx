"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Popover as P } from "radix-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extensionMarker, onPendingAvailable } from "@/lib/extension-client";
import { relativeTime } from "@/lib/format";
import { syncErrorCopy } from "@/lib/sync-errors";
import { collectPending, runExtensionSync, runOfficialSync, type SyncOutcome } from "@/lib/sync-client";
import { cn } from "@/lib/utils";
import type { ShellData } from "./shell";
import { useToast } from "./toast";

export function SyncControl({ data }: { data: ShellData }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [open, setOpen] = useState(false);
  const autoRan = useRef(false);

  const conn = data.connection;

  const finish = useCallback(
    (out: SyncOutcome, quiet = false) => {
      setBusy(false);
      setStage(null);
      if (!out.ok) {
        setError({ code: out.code, message: out.message });
        if (!quiet) setOpen(true);
        return;
      }
      setError(null);
      const n = out.summary.changes;
      if (!quiet || n > 0) {
        toast({
          tone: "success",
          title: n > 0 ? `${n} grade${n === 1 ? "" : "s"} changed` : "Grades are up to date",
          body: `${out.summary.courses} courses, ${out.summary.assignments} assignments checked.`,
        });
      }
      router.refresh();
    },
    [router, toast],
  );

  const sync = useCallback(async () => {
    if (!conn || busy) return;
    setBusy(true);
    setError(null);
    setStage("Starting");
    const out = conn.method === "api" ? await runOfficialSync() : await runExtensionSync({ kind: "sync" }, (p) => setStage(p.message));
    finish(out);
  }, [conn, busy, finish]);

  // Pick up captures the extension made while the student browsed Schoology.
  useEffect(() => {
    if (!conn || !extensionMarker()) return;
    const take = async () => {
      const out = await collectPending();
      if (out) finish(out, true);
    };
    void take();
    return onPendingAvailable(() => void take());
  }, [conn, finish]);

  // /app?sync=1 (opened from the extension popup) starts a sync immediately.
  useEffect(() => {
    if (autoRan.current || !conn) return;
    if (new URLSearchParams(location.search).get("sync") === "1") {
      autoRan.current = true;
      // Starting an external process (the extension sync) in response to the URL.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void sync();
    }
  }, [conn, sync]);

  if (!conn) {
    return (
      <Button asChild size="sm">
        <Link href="/connect">Connect Schoology</Link>
      </Button>
    );
  }

  const copy = error ? syncErrorCopy(error.code, error.message) : null;

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <div className="flex items-center">
        <span className={cn("mr-2 hidden text-xs text-ink-2 md:inline", busy && "text-brand-ink")} aria-live="polite">
          {busy ? stage ?? "Syncing" : conn.status === "expired" ? "Reconnect needed" : `Synced ${relativeTime(conn.lastSyncAt).toLowerCase()}`}
        </span>
        <Button variant="secondary" size="sm" onClick={sync} disabled={busy} aria-label="Sync now with Schoology" className="gap-1.5">
          <RefreshCw className={cn(busy && "animate-spin")} />
          <span className="hidden sm:inline">{busy ? "Syncing" : "Sync"}</span>
        </Button>
        {copy && (
          <P.Trigger className="ml-1 inline-flex size-8 items-center justify-center rounded-md text-danger hover:bg-danger-wash" aria-label="Show sync problem">
            <AlertCircle className="size-[18px]" />
          </P.Trigger>
        )}
      </div>
      <P.Portal>
        <P.Content align="end" sideOffset={8} className="z-50 w-80 rounded-lg border border-line bg-surface p-4 shadow-2 data-[state=open]:animate-[fade-in_120ms_ease-out]">
          {copy && (
            <>
              <p className="text-sm font-bold text-danger">{copy.title}</p>
              <p className="mt-1 text-sm text-ink-2">{copy.recovery}</p>
              <div className="mt-3 flex gap-2">
                {copy.action ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={copy.action.href}>{copy.action.label}</Link>
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => (setOpen(false), void sync())}>
                  Try again
                </Button>
              </div>
            </>
          )}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
