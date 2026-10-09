import Link from "next/link";
import { KlarLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/**
 * 404 as a gradebook entry: the page is "excused", so it doesn't count
 * against you.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 sm:px-8">
        <Link href="/" aria-label="Klar home">
          <KlarLogo />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-line bg-surface shadow-2">
            <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs font-semibold text-ink-2">
              <span>Assignment</span>
              <span>Score</span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-5">
              <div className="min-w-0">
                <p className="font-bold">The page you were looking for</p>
                <p className="mt-0.5 text-sm text-ink-2">Due: never existed</p>
              </div>
              <div className="text-right">
                <p className="tabular text-2xl font-extrabold tracking-tight">
                  404<span className="text-ink-3">/404</span>
                </p>
                <span className="rounded-[5px] border border-line px-1.5 py-0.5 text-2xs font-semibold text-ink-2">Excused</span>
              </div>
            </div>
          </div>
          <h1 className="mt-10 text-3xl font-extrabold tracking-tight">This page doesn&rsquo;t exist</h1>
          <p className="mt-2 text-ink-2">It won&rsquo;t count against your grade.</p>
          <div className="mt-8 flex gap-3">
            <Button asChild>
              <Link href="/app">Go to my dashboard</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Klar home</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
