import Link from "next/link";
import type { ReactNode } from "react";
import { KlarLogo } from "@/components/brand/logo";

/** Minimal chrome for focused flows (sign in, onboarding). */
export function FlowShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Klar home">
          <KlarLogo />
        </Link>
        {aside}
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-5 pt-[8vh] pb-16 sm:px-8">
        {children}
      </main>
      <footer className="px-5 pb-6 text-center text-xs text-ink-3 sm:px-8">
        Klar is independent and not affiliated with or endorsed by Schoology or PowerSchool.
      </footer>
    </div>
  );
}
