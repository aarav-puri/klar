"use client";
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "klar-local-setting";

/**
 * A localStorage-backed preference that is hydration-safe: the server and
 * first client render use `fallback`, then the stored value takes over.
 * Storage failures (private mode, blocked storage) fall back silently.
 */
export function useLocalSetting<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const subscribe = useCallback((cb: () => void) => {
    const on = (e: Event) => {
      if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent<string>).detail === key) cb();
    };
    window.addEventListener("storage", on);
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener("storage", on);
      window.removeEventListener(EVENT, on);
    };
  }, [key]);
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return (localStorage.getItem(key) as T | null) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    },
    [key],
  );
  return [value, set];
}

/** A value only the browser knows (like local time). Null during SSR. */
export function useClientOnly<T>(read: () => T): T | null {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => null,
  );
}
