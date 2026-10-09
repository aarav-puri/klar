import { ERROR_COPY, type ExtStatus } from "@klar/core/protocol";
import { useCallback, useEffect, useState } from "react";
import { KlarSymbol } from "./Symbol";

type PopupStatus = ExtStatus & { appUrl: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: { code: keyof typeof ERROR_COPY; message: string } };

function send<T>(msg: Record<string, unknown>): Promise<Result<T>> {
  return chrome.runtime.sendMessage({ kind: "popup", ...msg });
}

function relative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - Date.parse(iso);
  const m = Math.round(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Popup() {
  const grantHost = new URLSearchParams(location.search).get("grant");
  return grantHost ? <GrantView host={grantHost} /> : <StatusView />;
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="hdr">
      <div className="brand">
        <KlarSymbol />
        <span className="word">klar</span>
      </div>
      {right}
    </header>
  );
}

function StatusView() {
  const [status, setStatus] = useState<PopupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await send<PopupStatus>({ action: "status" });
    if (r.ok) setStatus(r.data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!status) return <div className="shell"><Header /><div className="skeleton" /></div>;

  const openApp = (path: string) => chrome.tabs.create({ url: `${status.appUrl}${path}` });

  const disconnect = async () => {
    setBusy(true);
    await send({ action: "disconnect" });
    setBusy(false);
    await refresh();
  };

  const err = status.lastError;

  return (
    <div className="shell">
      <Header right={<span className={`pill ${status.connected ? "ok" : ""}`}>{status.connected ? "Connected" : "Not connected"}</span>} />

      {status.connected ? (
        <>
          <section className="card">
            <dl className="facts">
              <div>
                <dt>School site</dt>
                <dd title={status.host ?? ""}>{status.host}</dd>
              </div>
              {status.accountLabel && (
                <div>
                  <dt>Account</dt>
                  <dd>{status.accountLabel}</dd>
                </div>
              )}
              <div>
                <dt>Last sync</dt>
                <dd>{relative(status.lastSyncAt)}</dd>
              </div>
            </dl>
          </section>

          {err && (
            <section className="alert" role="alert">
              <strong>{ERROR_COPY[err.code]?.title ?? "Sync problem"}</strong>
              <p>{err.message !== ERROR_COPY[err.code]?.title ? err.message : ERROR_COPY[err.code]?.recovery}</p>
            </section>
          )}
          <button className="btn primary" onClick={() => openApp("/app")}>Open dashboard</button>

          <button className="link danger" onClick={disconnect} disabled={busy}>
            Disconnect this browser
          </button>
        </>
      ) : (
        <section className="empty">
          <h1>Connect from Klar</h1>
          <p>Start in the Klar web app.</p>
          <button className="btn primary" onClick={() => openApp("/connect")}>Open Klar</button>
        </section>
      )}

      <footer className="foot">
        v{status.version}
      </footer>
    </div>
  );
}

function GrantView({ host }: { host: string }) {
  const [state, setState] = useState<"idle" | "granted" | "denied">("idle");
  const grant = async () => {
    const ok = await chrome.permissions.request({ origins: [`https://${host}/*`] });
    if (ok) await send({ action: "granted", host });
    setState(ok ? "granted" : "denied");
  };
  return (
    <div className="shell grant">
      <Header />
      <section className="empty">
        <h1>Allow Klar on {host}?</h1>
        <p>
          Chrome needs your OK for Klar to read your gradebook there. Klar only reads <code>/grades/grades</code>, and
          never your password.
        </p>
        {state === "granted" ? (
          <p className="note ok">Done. Go back to Klar and try again.</p>
        ) : (
          <button className="btn primary" onClick={grant}>Allow access to {host}</button>
        )}
        {state === "denied" && <p className="note">Chrome didn't allow it. Try again anytime.</p>}
      </section>
    </div>
  );
}
