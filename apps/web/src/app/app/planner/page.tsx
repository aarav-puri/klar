import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Planner } from "@/components/app/planner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { getWorkspace } from "@/server/data/workspace";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage() {
  const ws = (await getWorkspace())!;
  return (
    <div>
      <PageHeader title="Planner" description="Goals and GPA, worked out from your real grades." />
      {ws.courses.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing to plan yet"
            action={
              <Button asChild>
                <Link href="/connect">{ws.connection ? "Sync again" : "Connect Schoology"}</Link>
              </Button>
            }
          >
            Your courses show up here after your first sync.
          </EmptyState>
        </Panel>
      ) : (
        <Planner courses={ws.courses} />
      )}
    </div>
  );
}
