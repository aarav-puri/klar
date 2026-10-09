"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { callExtension } from "@/lib/extension-client";
import { useToast } from "./toast";


function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-3.5">
      <div id={id} className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {hint ? <p className="text-sm text-ink-2">{hint}</p> : null}
      </div>
      <div aria-labelledby={id} className="shrink-0">{children}</div>
    </div>
  );
}

export function DangerZone() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (url: string, method: string, success: string, after: string) => {
    setBusy(true);
    const res = await fetch(url, { method }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: { message: string } } | null;
      return toast({ tone: "danger", title: "That didn't work", body: body?.error?.message ?? "Try again." });
    }
    // The extension keeps only connection status; clear it too if present.
    void callExtension({ type: "DISCONNECT" }, { timeoutMs: 1500 });
    toast({ tone: "success", title: success });
    router.push(after);
    router.refresh();
  };

  return (
    <div className="divide-y divide-line border-t border-line">
      <Row title="Delete my grade data" hint="Your account stays.">
        <Confirm
          trigger="Delete data"
          title="Delete all synced grade data?"
          body="This can't be undone. Schoology isn't affected."
          confirm="Delete data"
          disabled={busy}
          onConfirm={() => run("/api/account/data", "DELETE", "Your grade data was deleted", "/app")}
        />
      </Row>
      <Row title="Delete my Klar account">
        <Confirm
          trigger="Delete account"
          title="Delete your Klar account?"
          body="This permanently deletes your account and data. Schoology isn't affected."
          confirm="Delete account"
          disabled={busy}
          onConfirm={() => run("/api/account", "DELETE", "Your account was deleted", "/")}
        />
      </Row>
    </div>
  );
}

function Confirm(props: { trigger: string; title: string; body: string; confirm: string; disabled?: boolean; onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm" disabled={props.disabled}>
          {props.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent title={props.title} description={props.body}>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="danger" onClick={props.onConfirm}>
              {props.confirm}
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionActions({ method }: { method: "extension" | "api" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const disconnect = async () => {
    setBusy(true);
    const res = await fetch("/api/account/disconnect", { method: "POST" }).catch(() => null);
    if (method === "extension") await callExtension({ type: "DISCONNECT" }, { timeoutMs: 2000 });
    setBusy(false);
    if (!res?.ok) return toast({ tone: "danger", title: "Couldn't disconnect", body: "Try again." });
    toast({ tone: "success", title: "Schoology disconnected", body: "Your synced grades are kept until you delete them." });
    router.refresh();
  };
  return (
    <Confirm
      trigger="Disconnect"
      title="Disconnect Schoology?"
      body={
        method === "api"
          ? "Klar deletes its Schoology access. Your synced grades stay until you delete them."
          : "The extension stops reading your gradebook. Your synced grades stay until you delete them."
      }
      confirm="Disconnect"
      disabled={busy}
      onConfirm={disconnect}
    />
  );
}
