"use client";
import { useSyncExternalStore } from "react";

export const MOBILE_SYNC_MESSAGE = "Sync is only available on a computer browser.";

/**
 * Phones and tablets can't run the Klar extension, so syncing is turned off
 * there. iPadOS reports itself as a Mac, so a touch-capable "Mac" counts too.
 */
export function isMobileDevice(nav: Pick<Navigator, "userAgent" | "maxTouchPoints"> & { userAgentData?: { mobile?: boolean } }): boolean {
  if (nav.userAgentData?.mobile) return true;
  const ua = nav.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
  return /Macintosh/.test(ua) && nav.maxTouchPoints > 1;
}

const noop = () => () => {};

/** False on the server and first render, then the real answer. */
export function useIsMobileDevice(): boolean {
  return useSyncExternalStore(noop, () => isMobileDevice(navigator as Navigator & { userAgentData?: { mobile?: boolean } }), () => false);
}
