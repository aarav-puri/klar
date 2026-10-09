/** Formatting helpers. Every grade string in the UI goes through here. */

export function splitPercent(p: number, decimals = 1): { whole: string; fraction: string } {
  const fixed = p.toFixed(decimals);
  const [whole, fraction = ""] = fixed.split(".");
  return { whole: whole!, fraction: fraction ? `.${fraction}` : "" };
}

export function fmtPercent(p: number | null, decimals = 1): string {
  return p === null ? "No grade" : `${p.toFixed(decimals)}%`;
}

export function fmtDelta(d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${sign}${Math.abs(d).toFixed(1)}`;
}

export function fmtPoints(n: number | null): string {
  if (n === null) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dayTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtDayTime = (iso: string) => dayTimeFmt.format(new Date(iso));
export const fmtWeekday = (iso: string) => weekdayFmt.format(new Date(iso));

export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Never";
  const diff = now.getTime() - Date.parse(iso);
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60_000);
  const wrap = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (m < 1) return "Just now";
  if (m < 60) return wrap(`${m} min`);
  const h = Math.round(m / 60);
  if (h < 24) return wrap(`${h} hr`);
  const d = Math.round(h / 24);
  if (d < 7) return wrap(`${d} day${d === 1 ? "" : "s"}`);
  return fmtDay(iso);
}

/** "Due tomorrow", "Due in 3 days", "Was due Oct 2". */
export function dueLabel(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(now)) / 86_400_000);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1 && days < 7) return `Due ${new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(due)}`;
  if (days < 0) return `Was due ${fmtDay(iso)}`;
  return `Due ${fmtDay(iso)}`;
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
