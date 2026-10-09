import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)] disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Landing-page style: 2px border, hard shadow, and a press into the shadow on hover.
        primary: "nb-border nb-shadow nb-press bg-nb-dark text-white dark:bg-nb-pop dark:text-nb-text",
        secondary: "nb-border nb-shadow nb-press bg-surface text-ink",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        quiet: "nb-border bg-nb-pop text-nb-text hover:brightness-95",
        danger: "nb-border nb-shadow nb-press bg-surface text-danger",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-sm",
        md: "h-10 rounded-xl px-4 text-sm",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "size-9 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
