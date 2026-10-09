"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="text-3xl font-extrabold tracking-tight">Something broke on this page</h1>
      <p className="mt-2 text-ink-2">Your grades aren&rsquo;t affected.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="ghost">
          <Link href="/">Klar home</Link>
        </Button>
      </div>
    </main>
  );
}
