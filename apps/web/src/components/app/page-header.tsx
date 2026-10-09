import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold tracking-tighter text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-ink-2">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
