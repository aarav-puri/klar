import type { Metadata } from "next";
import Link from "next/link";
import { FlowShell } from "@/components/onboarding/flow-shell";
import { ForgotPasswordForm } from "@/components/onboarding/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <FlowShell>
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
        <p className="mt-2 text-ink-2">We&rsquo;ll email you a link to choose a new one.</p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="font-semibold text-brand-ink hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </FlowShell>
  );
}
