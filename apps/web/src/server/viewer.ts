import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { asStudent, getDb } from "./db";
import { authConfigured, getAuth } from "./neon-auth";

export type Viewer = { kind: "user"; userId: string; email: string; name: string | null } | { kind: "anonymous" };

/** Who is looking at the page, from the Neon Auth session. */
export const getViewer = cache(async (): Promise<Viewer> => {
  if (!authConfigured()) return { kind: "anonymous" };
  let user: { id: string; email: string; name?: string | null } | undefined;
  try {
    const { data } = await getAuth().getSession();
    user = data?.user;
  } catch (e) {
    // Let Next.js's own signals through (for example "this page reads cookies,
    // so render it per request"); swallowing them made signed-in pages static.
    unstable_rethrow(e);
    // A stale or invalid session cookie (for example right after sign-out)
    // makes the SDK try to clear it, which Next.js forbids while rendering a
    // page. The visitor simply isn't signed in; the cookie is replaced on
    // their next sign-in and refreshed by the /app proxy.
    return { kind: "anonymous" };
  }
  if (!user?.id) return { kind: "anonymous" };
  await ensureAccount(user.id, user.name ?? null);
  return { kind: "user", userId: user.id, email: user.email, name: user.name ?? null };
});

/**
 * Create Klar's per-student rows (profile and settings) the first time we see a Neon Auth user. Idempotent.
 */
export async function ensureAccount(userId: string, name: string | null): Promise<void> {
  const first = name?.trim().split(/\s+/)[0]?.slice(0, 80) || null;
  await asStudent(await getDb(), userId, async (tx) => {
    await tx.query(`insert into public.profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [userId, first]);
    await tx.query(`insert into public.user_settings (user_id) values ($1) on conflict (user_id) do nothing`, [userId]);
  });
}
