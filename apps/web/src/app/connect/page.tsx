import type { Metadata } from "next";
import Link from "next/link";
import { FlowShell } from "@/components/onboarding/flow-shell";
import { LoginForm } from "@/components/onboarding/login-form";
import { Onboarding } from "@/components/onboarding/onboarding";
import { getWorkspace } from "@/server/data/workspace";
import { env, officialApiConfigured } from "@/server/env";
import { authConfigured } from "@/server/neon-auth";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Connect Schoology" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ method?: string; step?: string; error?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();

  if (viewer.kind !== "user") {
    return (
      <FlowShell>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-extrabold tracking-tight">First, create your Klar account</h1>
          <p className="mt-2 text-ink-2">Only you can see your grades.</p>
          <div className="mt-8">
            {authConfigured() ? (
              <LoginForm next="/connect" initialMode="signup" allowSignups={env.allowSignups} />
            ) : (
              <p role="alert" className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-2">
                Sign-in isn&rsquo;t set up on this server yet (see the README).
              </p>
            )}
          </div>
        </div>
      </FlowShell>
    );
  }

  const ws = await getWorkspace();
  return (
    <FlowShell aside={<Link href="/app" className="text-sm font-semibold text-ink-2 hover:text-ink">Skip for now</Link>}>
      <Onboarding
        officialApi={officialApiConfigured}
        storeUrl={env.extensionStoreUrl}
        existingHost={ws?.connection?.host ?? null}
        initial={{ method: sp.method === "api" ? "api" : sp.method === "extension" ? "extension" : undefined, step: sp.step, error: sp.error }}
      />
    </FlowShell>
  );
}
