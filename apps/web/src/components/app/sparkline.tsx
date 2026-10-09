import type { SnapshotPoint } from "@/server/data/types";

/** Tiny inline trend. Pure SVG so it renders on the server. */
export function Sparkline({ points, className, label }: { points: SnapshotPoint[]; className?: string; label: string }) {
  const valid = points.filter((p): p is { capturedAt: string; percent: number } => p.percent !== null);
  if (valid.length < 2) return null;
  const W = 120;
  const H = 32;
  const values = valid.map((p) => p.percent);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) {
    const mid = (max + min) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  const t0 = Date.parse(valid[0]!.capturedAt);
  const t1 = Date.parse(valid.at(-1)!.capturedAt);
  const x = (iso: string) => (t1 === t0 ? W : ((Date.parse(iso) - t0) / (t1 - t0)) * (W - 4) + 2);
  const y = (v: number) => H - 3 - ((v - min) / (max - min)) * (H - 6);
  const d = valid.map((p, i) => `${i ? "L" : "M"}${x(p.capturedAt).toFixed(1)} ${y(p.percent).toFixed(1)}`).join(" ");
  const last = valid.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label} preserveAspectRatio="none">
      <path d={`${d} L${x(last.capturedAt)} ${H} L2 ${H} Z`} fill="url(#spark-fill)" opacity="0.5" />
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.capturedAt)} cy={y(last.percent)} r="2.4" fill="var(--brand)" />
    </svg>
  );
}
