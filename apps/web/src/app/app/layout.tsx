import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { getWorkspace } from "@/server/data/workspace";
import { env } from "@/server/env";

// Every page here is per-student and reads the session; never try to prerender.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  if (!ws) redirect("/login?next=/app");
  return (
    <AppShell
      data={{
        displayName: ws.displayName,
        fullName: ws.fullName,
        connection: ws.connection,
        extensionStoreUrl: env.extensionStoreUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
