import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FlowShell } from "@/components/onboarding/flow-shell";
import { LoginForm } from "@/components/onboarding/login-form";
import { env } from "@/server/env";
import { authConfigured } from "@/server/neon-auth";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next: rawNext, reset } = await searchParams;
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  const viewer = await getViewer();
  if (viewer.kind === "user") redirect(next);

  return (
    <FlowShell>
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">Sign in to Klar</h1>
        {reset === "1" && (
          <p role="status" className="mt-4 rounded-md bg-success-wash px-3 py-2 text-sm font-semibold text-success">
            Your password was changed. Sign in with your new password.
          </p>
        )}
        <div className="mt-8">
          {authConfigured() ? (
            <LoginForm next={next} allowSignups={env.allowSignups} />
          ) : (
            <div role="alert" className="rounded-lg border border-dashed border-line-strong p-5 text-sm text-ink-2">
              <p className="font-bold text-ink">Sign-in isn&rsquo;t set up on this server</p>
              <p className="mt-1">Add NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (see the README).</p>
            </div>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-ink-3">
          <Link href="/privacy" className="underline">How Klar handles your data</Link>
        </p>
      </div>
    </FlowShell>
  );
}
