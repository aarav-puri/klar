"use client";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { signInAction, signUpAction, type FormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

/**
 * Sign in or create a Klar account. This password protects Klar only and is
 * never a Schoology or school password.
 */
export function LoginForm({ next, initialMode = "signin", allowSignups = true }: { next: string; initialMode?: "signin" | "signup"; allowSignups?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">(allowSignups ? initialMode : "signin");
  const [signInState, signIn, signingIn] = useActionState<FormState, FormData>(signInAction, { error: null });
  const [signUpState, signUp, signingUp] = useActionState<FormState, FormData>(signUpAction, { error: null });
  const ids = { n: useId(), e: useId(), p: useId() };
  const [show, setShow] = useState(false);
  const signup = mode === "signup";
  const state = signup ? signUpState : signInState;
  const error = state.error;
  const pending = signup ? signingUp : signingIn;

  return (
    <form action={signup ? signUp : signIn} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {allowSignups && (
        <Segmented
          label="Account"
          value={mode}
          onChange={setMode}
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
          className="w-full [&>button]:flex-1"
        />
      )}
      {signup && (
        <div>
          <Label htmlFor={ids.n}>First name</Label>
          <Input key={`n-${signUpState.name ?? ""}`} id={ids.n} name="name" required autoComplete="given-name" maxLength={80} defaultValue={signUpState.name} className="h-11" />
        </div>
      )}
      <div>
        <Label htmlFor={ids.e}>Email</Label>
        <Input key={`e-${mode}-${state.email ?? ""}`} id={ids.e} name="email" type="email" required autoComplete="email" defaultValue={state.email} placeholder="you@example.com" className="h-11" />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor={ids.p}>{signup ? "Choose a Klar password" : "Klar password"}</Label>
          {!signup && (
            <Link href="/forgot-password" className="mb-1.5 text-sm font-semibold text-brand-ink hover:underline">
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id={ids.p}
            name="password"
            type={show ? "text" : "password"}
            required
            minLength={signup ? 10 : undefined}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
            className="h-11 pr-11"
            aria-describedby={`${ids.p}-hint`}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-ink-3 hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p id={`${ids.p}-hint`} className="mt-1.5 text-xs text-ink-3">
          {signup ? "At least 10 characters. " : ""}Not your Schoology password.
        </p>
      </div>
      {signup && (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-2">
          <input type="checkbox" name="agree" required className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
          <span>
            I&rsquo;m 13 or older and I agree to the{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand-ink underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (signup ? "Creating account" : "Signing in") : signup ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
