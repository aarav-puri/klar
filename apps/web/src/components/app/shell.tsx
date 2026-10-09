"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { KlarSymbol } from "@/components/brand/logo";
import { useLocalSetting } from "@/lib/use-local-setting";
import type { ConnectionView } from "@/server/data/types";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { SyncControl } from "./sync-control";
import { ThemeToggle } from "./theme-toggle";
import { Toaster } from "./toast";

export interface ShellData {
  displayName: string | null;
  fullName: string | null;
  connection: ConnectionView | null;
  extensionStoreUrl: string;
}

export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const [sidebar, setSidebar] = useLocalSetting<"open" | "collapsed">("klar-sidebar", "open");
  const collapsed = sidebar === "collapsed";
  const toggle = () => setSidebar(collapsed ? "open" : "collapsed");

  return (
    <Toaster>
      <div className="flex min-h-dvh">
        <Sidebar data={data} collapsed={collapsed} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b-2 border-nb-line bg-nb-pop px-4 text-nb-text sm:px-6 lg:px-10">
            <Link href="/app" className="mr-auto flex items-center gap-2 lg:hidden" aria-label="Klar overview">
              <KlarSymbol className="size-6" />
            </Link>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <SyncControl data={data} />
              <ThemeToggle />
              <AccountMenu data={data} />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-16">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </Toaster>
  );
}
