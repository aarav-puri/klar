import { splitPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The Klar signature: the whole number sits on the baseline and the decimal
 * is lifted, echoing the raised half of the logo.
 */
export function GradeNumeral({
  percent,
  className,
  decimals = 1,
  muted = false,
  showPercent = true,
}: {
  percent: number | null;
  className?: string;
  decimals?: number;
  muted?: boolean;
  showPercent?: boolean;
}) {
  if (percent === null) {
    return <span className={cn("font-semibold tracking-tight text-ink-3", className)}>No grade yet</span>;
  }
  const { whole, fraction } = splitPercent(percent, decimals);
  return (
    <span
      className={cn("tabular inline-flex items-start font-bold leading-none tracking-tightest", muted ? "text-ink-2" : "text-ink", className)}
      aria-label={`${percent.toFixed(decimals)} percent`}
    >
      <span aria-hidden>{whole}</span>
      <span aria-hidden className={cn("-translate-y-[0.14em] text-[0.62em]", muted ? "text-ink-3" : "text-brand")}>
        {fraction}
        {showPercent ? <span className="ml-[0.06em] text-[0.8em] font-semibold opacity-80">%</span> : null}
      </span>
    </span>
  );
}
