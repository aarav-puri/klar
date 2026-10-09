import type { Metadata } from "next";
import Link from "next/link";
import { FlowShell } from "@/components/onboarding/flow-shell";
import { ResetPasswordForm } from "@/components/onboarding/password-forms";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Choose a new password" };

/** Neon Auth sends people here as /reset-password?token=... (or ?error=INVALID_TOKEN). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const usable = Boolean(token && !error && /^[A-Za-z0-9_-]{8,200}$/.test(token));
  return (
    <FlowShell>
      <div className="w-full max-w-sm">
        {usable ? (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight">Choose a new password</h1>
            <div className="mt-8">
              <ResetPasswordForm token={token!} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold tracking-tight">This link doesn&rsquo;t work</h1>
            <p className="mt-2 text-ink-2">Reset links work once and expire after an hour.</p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </>
        )}
      </div>
    </FlowShell>
  );
}
