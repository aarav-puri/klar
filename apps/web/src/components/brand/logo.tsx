import { cn } from "@/lib/utils";

/**
 * Klar symbol: a disc split in two, the right half lifted. It reads as a
 * lens bringing something into focus, and as a quiet step up.
 */
export function KlarSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M15 7a11 11 0 0 0 0 22z" fill="var(--sym-l)" />
      <path d="M17 3a11 11 0 0 1 0 22z" fill="var(--sym-r)" />
    </svg>
  );
}

/** Custom geometric wordmark drawn on a 5-unit stroke grid. */
export function KlarWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 68 32" className={cn("h-5 w-auto", className)} aria-hidden="true">
      <defs>
        <clipPath id="klar-xh">
          <rect x="0" y="12" width="80" height="18" />
        </clipPath>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="5">
        <path d="M4.5 1V30" />
        <g clipPath="url(#klar-xh)">
          <path d="M6 25L19 8.5" />
          <path d="M9 21.2L19.8 33" />
          <path d="M57 30V18.5C57 15.5 59 14.5 63 14.5H66" />
        </g>
        <path d="M27.5 1V30" />
        <circle cx="41" cy="21" r="6.5" />
        <path d="M47.5 12V30" />
      </g>
    </svg>
  );
}

export function KlarLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: ["size-5", "h-4"], md: ["size-6", "h-[18px]"], lg: ["size-9", "h-7"] }[size];
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)} aria-label="Klar" role="img">
      <KlarSymbol className={s[0]} />
      <KlarWordmark className={s[1]} />
    </span>
  );
}
