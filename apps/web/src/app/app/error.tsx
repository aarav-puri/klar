"use client";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Panel className="mx-auto mt-10 max-w-lg px-6 py-8">
      <h1 className="text-xl font-bold tracking-tight">This view couldn&rsquo;t load</h1>
      <p className="mt-2 text-sm text-ink-2">
        Nothing was changed. Check your connection and try again.
        {error.digest ? <span className="mt-2 block text-xs text-ink-3">Reference {error.digest}</span> : null}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </Panel>
  );
}
