"use client";
import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Segmented } from "@/components/ui/segmented";
import { useLocalSetting } from "@/lib/use-local-setting";

export type Theme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(cb: () => void) {
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * The theme starts from the device's light/dark setting and follows it until
 * the student picks one; after that, their choice sticks.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [stored, setStored] = useLocalSetting<string>("klar-theme", "");
  const systemDark = useSyncExternalStore(subscribeSystem, () => matchMedia(DARK_QUERY).matches, () => false);
  const theme: Theme = stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";

  // Keep the page in sync (including when the device switches and no choice
  // was made). Read the real sources here rather than `theme`, which uses a
  // placeholder during hydration and would briefly flash the wrong theme.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("klar-theme");
    } catch {}
    const dark = saved === "dark" || (saved !== "light" && matchMedia(DARK_QUERY).matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [stored, systemDark]);

  const set = useCallback((t: Theme) => setStored(t), [setStored]);
  return [theme, set];
}

/** Icon button that flips between light and dark. */
export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

export function ThemeSegmented() {
  const [theme, setTheme] = useTheme();
  return (
    <Segmented
      label="Theme"
      value={theme}
      onChange={setTheme}
      options={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
