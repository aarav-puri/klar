import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-bold [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-2",
        brand: "bg-brand-wash text-brand-ink",
        success: "bg-success-wash text-success",
        warning: "bg-warning-wash text-warning",
        danger: "bg-danger-wash text-danger",
        outline: "border-2 border-nb-line text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
