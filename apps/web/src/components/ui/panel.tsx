import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The base surface: a 2px border and a hard shadow, like the website's cards. */
export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("nb-border nb-shadow rounded-2xl bg-surface", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <Heading className="text-lg font-extrabold tracking-tight text-ink">{title}</Heading>
        {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
