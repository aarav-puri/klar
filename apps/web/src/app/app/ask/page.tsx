import type { Metadata } from "next";
import { AskKlar } from "@/components/app/ask-klar";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/ui/panel";
import { upcoming, flattenAssignments } from "@/lib/workload";
import { getWorkspace } from "@/server/data/workspace";
import { assistantConfigured } from "@/server/env";

export const metadata: Metadata = { title: "Ask Klar" };

function suggestionsFor(ws: NonNullable<Awaited<ReturnType<typeof getWorkspace>>>): string[] {
  const now = new Date(ws.generatedAt);
  const next = upcoming(flattenAssignments(ws.courses), now, 30).find((r) => r.possible);
  const graded = ws.courses.filter((c) => c.percent !== null);
  const lowest = [...graded].sort((a, b) => a.percent! - b.percent!)[0];
  return [
    next ? `What do I need on ${next.title} to keep my grade in ${next.courseName}?` : "What do I need on my next test to keep an A?",
    lowest ? `How can I bring up my grade in ${lowest.name}?` : "Which class should I focus on?",
    ws.courses.some((c) => c.plan.goalPercent !== null) ? "Am I on track for my goals?" : "What changed in my grades this week?",
    "Which assignments are missing or late?",
  ];
}

export default async function AskPage() {
  const ws = (await getWorkspace())!;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Ask Klar" />
      {!assistantConfigured ? (
        <Panel className="px-5 py-4 text-sm text-ink-2">Ask Klar isn&rsquo;t set up on this server yet.</Panel>
      ) : ws.courses.length === 0 ? (
        <Panel className="px-5 py-4 text-sm text-ink-2">Sync your grades first, then ask about them here.</Panel>
      ) : (
        <AskKlar suggestions={suggestionsFor(ws)} />
      )}
    </div>
  );
}
