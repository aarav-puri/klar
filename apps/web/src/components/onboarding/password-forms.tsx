"use client";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";
import { forgotPasswordAction, resetPasswordAction, type FormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, { error: null });
  const id = useId();
  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-line bg-surface p-5">
        <MailCheck className="size-5 text-brand" />
        <p className="mt-3 font-bold">Check your email</p>
        <p className="mt-1 text-sm text-ink-2">
          If <strong className="text-ink">{state.email}</strong> has a Klar account, a reset link is on its way. It expires in an hour.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-brand-ink hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor={id}>Email</Label>
        <Input key={state.email ?? ""} id={id} name="email" type="email" required autoComplete="email" defaultValue={state.email} placeholder="you@example.com" className="h-11" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending link" : "Email me a reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, { error: null });
  const ids = { p: useId(), c: useId() };
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <Label htmlFor={ids.p}>New Klar password</Label>
        <Input id={ids.p} name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className="h-11" />
        <p className="mt-1.5 text-xs text-ink-3">At least 10 characters. Not your Schoology password.</p>
      </div>
      <div>
        <Label htmlFor={ids.c}>Type it again</Label>
        <Input id={ids.c} name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password" className="h-11" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}{" "}
          {/expired|already used/.test(state.error) && (
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          )}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving" : "Save new password"}
      </Button>
    </form>
  );
}
