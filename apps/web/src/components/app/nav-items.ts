import { LayoutDashboard, MessageCircle, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/ask", label: "Ask Klar", icon: MessageCircle },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" || pathname.startsWith("/app/courses/") : pathname === href || pathname.startsWith(`${href}/`);
}
