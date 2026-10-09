import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  children,
  action,
  className,
  art,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  art?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {art ?? <SplitDisc />}
      <h3 className="mt-4 text-base font-bold tracking-tight">{title}</h3>
      {children ? <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Outline version of the brand mark, used for empty states. */
function SplitDisc() {
  return (
    <svg viewBox="0 0 32 32" className="size-10" aria-hidden>
      <path d="M15 7a11 11 0 0 0 0 22z" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M17 3a11 11 0 0 1 0 22z" fill="var(--brand-wash)" stroke="var(--brand)" strokeWidth="1.5" />
    </svg>
  );
}
