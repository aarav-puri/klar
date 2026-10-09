"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(11_22_34/0.38)] backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-6 shadow-2 outline-none data-[state=open]:animate-[dialog-in_220ms_var(--ease-out)]",
          className,
        )}
      >
        <D.Title className="pr-8 text-lg font-bold tracking-tight">{title}</D.Title>
        {description ? <D.Description className="mt-1 text-sm text-ink-2">{description}</D.Description> : null}
        <div className="mt-5">{children}</div>
        <D.Close className="absolute top-4 right-4 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
