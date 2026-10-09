"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/server/env";
import { getAuth } from "@/server/neon-auth";
import { RateLimiter } from "@/server/rate-limit";

/** `email`/`name` echo what was typed so the form can keep it after an error. */
export type FormState = { error: string | null; ok?: boolean; email?: string; name?: string };

const ipLimiter = new RateLimiter(30, 15 * 60_000);
const emailLimiter = new RateLimiter(8, 15 * 60_000);
const resetLimiter = new RateLimiter(5, 60 * 60_000);

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/app");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Neon Auth error codes and messages, in Klar's words. */
function friendly(message: string | undefined, fallback: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid email or password") || m.includes("invalid password") || m.includes("user not found")) return "That email and password don't match a Klar account.";
  if (m.includes("already exists") || m.includes("already registered")) return "That email already has an account. Sign in instead.";
  if (m.includes("password") && m.includes("short")) return "Use at least 10 characters.";
  if (m.includes("password") && m.includes("long")) return "That password is too long.";
  if (m.includes("verify") && m.includes("email")) return "Confirm your email first. Check your inbox.";
  if (m.includes("invalid token") || m.includes("expired")) return "This reset link has expired or was already used. Request a new one.";
  if (m.includes("too many")) return "Too many tries. Wait a few minutes.";
  return fallback;
}

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!EMAIL_RE.test(email) || !password) return { error: "Enter your email and password.", email };
  if (!ipLimiter.check(await ip()).ok || !emailLimiter.check(email).ok) return { error: "Too many tries. Wait a few minutes.", email };
  const { error } = await getAuth().signIn.email({ email, password });
  if (error) return { error: friendly(error.message, "Couldn't sign in. Try again."), email };
  redirect(safeNext(field(fd, "next")));
}

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!env.allowSignups) return { error: "Sign-ups are closed right now." };
  const name = field(fd, "name").slice(0, 80);
  const email = field(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const keep = { email, name };
  if (!name) return { error: "Enter your first name.", ...keep };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", ...keep };
  if (password.length < 10) return { error: "Use at least 10 characters.", ...keep };
  if (password.length > 128) return { error: "Use at most 128 characters.", ...keep };
  if (fd.get("agree") !== "on") return { error: "Confirm you're 13 or older and agree to the Privacy Policy.", ...keep };
  if (!ipLimiter.check(await ip()).ok) return { error: "Too many tries. Wait a few minutes.", ...keep };
  const { error } = await getAuth().signUp.email({ email, password, name });
  if (error) return { error: friendly(error.message, "Couldn't create your account. Try again."), ...keep };
  redirect(safeNext(field(fd, "next") || "/connect"));
}

/**
 * Email a reset link. The reply is the same whether or not the account
 * exists, so this can't be used to find out who has an account.
 */
export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, "email").toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address.", email };
  if (!resetLimiter.check(email).ok || !ipLimiter.check(await ip()).ok) return { error: "Too many reset requests. Try again later.", email };
  const redirectTo = new URL("/reset-password", env.appUrl).toString();
  const { error } = await getAuth().requestPasswordReset({ email, redirectTo });
  if (error && !/not found/i.test(error.message ?? "")) console.error("[auth] reset request failed:", error.status ?? "", error.message ?? "");
  return { error: null, ok: true, email };
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = field(fd, "token");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!token) return { error: "This link is incomplete. Open it from your email again." };
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };
  if (!ipLimiter.check(await ip()).ok) return { error: "Too many tries. Wait a few minutes." };
  const { error } = await getAuth().resetPassword({ newPassword: password, token });
  if (error) return { error: friendly(error.message, "This reset link has expired or was already used. Request a new one.") };
  redirect("/login?reset=1");
}

export async function signOutAction(): Promise<void> {
  await getAuth().signOut();
  redirect("/");
}
