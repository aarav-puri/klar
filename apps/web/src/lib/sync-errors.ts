import { ERROR_COPY, type ErrorCode } from "@klar/core/protocol";

export interface ErrorCopy {
  title: string;
  recovery: string;
  action?: { label: string; href: string };
}

/** Human copy plus a recovery path for every way a sync can fail. */
export function syncErrorCopy(code: string, message?: string): ErrorCopy {
  if (code in ERROR_COPY) {
    const base = ERROR_COPY[code as ErrorCode];
    const custom = message && message !== base.title ? message : null;
    const copy: ErrorCopy = { title: base.title, recovery: custom ?? base.recovery };
    if (code === "NOT_CONNECTED") copy.action = { label: "Connect", href: "/connect" };
    return copy;
  }
  switch (code) {
    case "NOT_INSTALLED":
      return {
        title: "Klar extension not found",
        recovery: "Turn it on in chrome://extensions, or install it again.",
        action: { label: "Install help", href: "/connect?step=extension" },
      };
    case "TIMEOUT":
      return { title: "The extension stopped responding", recovery: "Reload this page. Still stuck? Turn the extension off and on in chrome://extensions." };
    case "SIGNED_OUT":
      return { title: "You're signed out", recovery: "Sign in to keep syncing.", action: { label: "Sign in", href: "/login" } };
    case "NETWORK":
      return { title: "No connection", recovery: message ?? "Check your internet and try again." };
    case "HOST_MISMATCH":
      return { title: "Different school site", recovery: message ?? "Reconnect in Settings to switch schools.", action: { label: "Settings", href: "/app/settings" } };
    case "EXPIRED":
      return { title: "Schoology access expired", recovery: "Reconnect to keep syncing.", action: { label: "Reconnect", href: "/connect?method=api" } };
    case "FORBIDDEN":
      return { title: "Your school blocks this access", recovery: "Your district turned off app access. Use the extension instead.", action: { label: "Use the extension", href: "/connect" } };
    case "UNAVAILABLE":
      return { title: "Schoology is unavailable", recovery: "Try again in a few minutes." };
    case "RATE_LIMITED":
      return { title: "Too many syncs", recovery: "Wait a minute, then try again." };
    case "INVALID_PAYLOAD":
    case "NO_COURSES":
      return { title: "Klar couldn't use that gradebook", recovery: message ?? "Open Grades in Schoology to check they're visible, then try again." };
    default:
      return { title: "Sync didn't finish", recovery: message ?? "Try again in a moment." };
  }
}
