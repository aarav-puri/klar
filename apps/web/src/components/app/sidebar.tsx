"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KlarSymbol, KlarWordmark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav-items";
import type { ShellData } from "./shell";

export function Sidebar({ data, collapsed, onToggle }: { data: ShellData; collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh flex-col border-r-2 border-nb-line bg-surface transition-[width] duration-300 ease-[var(--ease-out)] lg:flex",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
      aria-label="Primary"
    >
      <div className={cn("flex h-16 items-center border-b-2 border-nb-line bg-nb-pop", collapsed ? "justify-center" : "px-5")}>
        <Link href="/app" className="flex items-center gap-2 rounded-md" aria-label="Klar overview">
          <KlarSymbol className="size-6" />
          {!collapsed && <KlarWordmark className="h-[17px] text-ink" />}
        </Link>
      </div>

      <nav className="flex-1 px-3 pt-4">
        <ul className="space-y-1.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const link = (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl text-sm font-bold transition-colors",
                  collapsed ? "justify-center" : "px-3",
                  active ? "text-ink" : "text-ink-2 hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="nb-border nb-shadow absolute inset-0 rounded-xl bg-nb-pop"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className={cn("relative size-[18px] shrink-0", active ? "text-nb-text" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={2.2} />
                {!collapsed && <span className={cn("relative truncate", active && "text-nb-text")}>{item.label}</span>}
              </Link>
            );
            return <li key={item.href}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
          })}
        </ul>
      </nav>

      <div className="space-y-2 p-3">
        {!collapsed && <ConnectionCard data={data} />}
        <button
          type="button"
          onClick={onToggle}
          className={cn("flex h-9 w-full items-center gap-3 rounded-md text-sm font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink", collapsed ? "justify-center" : "px-3")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}

function ConnectionCard({ data }: { data: ShellData }) {
  if (!data.connection) {
    return (
      <Link href="/connect" className="block rounded-md bg-brand-wash px-3 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface))]">
        <p className="text-xs font-bold text-brand-ink">Connect Schoology</p>
      </Link>
    );
  }
  const c = data.connection;
  const healthy = c.status === "active" && !c.lastErrorCode;
  return (
    <div className="nb-border rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-ink">
        <span className={cn("size-1.5 rounded-full", healthy ? "bg-success" : "bg-warning")} />
        {c.status === "expired" ? "Reconnect needed" : "Connected"}
      </p>
      <p className="mt-0.5 truncate text-xs text-ink-2" title={c.host}>{c.host}</p>
    </div>
  );
}
