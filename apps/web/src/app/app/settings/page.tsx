import type { Metadata } from "next";
import Link from "next/link";
import { ConnectionActions, DangerZone } from "@/components/app/settings-forms";
import { PageHeader } from "@/components/app/page-header";
import { ThemeSegmented } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { fmtDayTime, relativeTime } from "@/lib/format";
import { getWorkspace } from "@/server/data/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ws = (await getWorkspace())!;
  const c = ws.connection;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />

      <Panel id="connection">
        <PanelHeader title="Schoology" />
        <div className="border-t border-line px-5 py-4">
          {!c ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-ink-2">Not connected.</p>
              <Button asChild size="sm">
                <Link href="/connect">Connect Schoology</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-2">School site</dt>
                  <dd className="font-semibold">{c.host}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Method</dt>
                  <dd className="font-semibold">{c.method === "api" ? "Official Schoology API" : "Klar browser extension"}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Status</dt>
                  <dd>
                    {c.status === "active" && !c.lastErrorCode ? (
                      <Badge tone="success">Working</Badge>
                    ) : c.status === "expired" ? (
                      <Badge tone="warning">Reconnect needed</Badge>
                    ) : (
                      <Badge tone="warning">Sync problem ({c.lastErrorCode})</Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-2">Last sync</dt>
                  <dd className="font-semibold">{c.lastSyncAt ? `${relativeTime(c.lastSyncAt)} (${fmtDayTime(c.lastSyncAt)})` : "Never"}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">Consent given</dt>
                  <dd className="font-semibold">{fmtDayTime(c.consentAt)}</dd>
                </div>
                {c.accountLabel && (
                  <div>
                    <dt className="text-ink-2">Schoology account</dt>
                    <dd className="font-semibold">{c.accountLabel}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/connect">Reconnect</Link>
                </Button>
                <ConnectionActions method={c.method} />
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Appearance" />
        <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-4">
          <p className="text-sm font-semibold">Theme</p>
          <ThemeSegmented />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Data" action={<Link className="text-sm font-semibold text-brand-ink hover:underline" href="/privacy">Privacy</Link>} />
        <DangerZone />
      </Panel>
    </div>
  );
}
