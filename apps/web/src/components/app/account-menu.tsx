"use client";
import { DropdownMenu as M } from "radix-ui";
import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import type { ShellData } from "./shell";

export function AccountMenu({ data }: { data: ShellData }) {
  const name = data.fullName || data.displayName || "Your account";
  const initial = ((data.fullName || data.displayName || "?")[0] ?? "?").toUpperCase();
  return (
    <M.Root>
      <M.Trigger
        className="ml-1 inline-flex size-8 items-center justify-center rounded-full bg-brand-wash text-sm font-bold text-brand-ink ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-line-strong"
        aria-label="Account menu"
      >
        {initial}
      </M.Trigger>
      <M.Portal>
        <M.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-lg border border-line bg-surface p-1.5 shadow-2 data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-bold">{name}</p>
            {data.connection?.host ? <p className="truncate text-xs text-ink-2">Connected to {data.connection.host}</p> : null}
          </div>
          <M.Separator className="my-1 h-px bg-line" />
          <M.Item asChild>
            <Link href="/app/settings" className="flex h-9 items-center rounded-md px-2.5 text-sm font-semibold outline-none data-[highlighted]:bg-surface-2">
              Settings
            </Link>
          </M.Item>
          <M.Item asChild>
            <Link href="/privacy" className="flex h-9 items-center rounded-md px-2.5 text-sm font-semibold outline-none data-[highlighted]:bg-surface-2">
              Privacy
            </Link>
          </M.Item>
          <M.Separator className="my-1 h-px bg-line" />
          <M.Item
            // A form inside the menu would unmount before submitting, so sign out directly.
            onSelect={() => void signOutAction()}
            className="flex h-9 w-full cursor-pointer items-center rounded-md px-2.5 text-left text-sm font-semibold outline-none data-[highlighted]:bg-surface-2"
          >
            Sign out
          </M.Item>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
