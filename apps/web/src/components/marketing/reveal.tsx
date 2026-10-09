"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Rises into view the first time it scrolls on screen. Content stays visible without JS. */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" | "ol" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.setAttribute("data-shown", "");
          io.disconnect();
        }
      },
      // A huge top margin counts anything already scrolled past as seen, so a fast
      // scroll or an anchor jump never leaves content hidden.
      { rootMargin: "100000px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`nb-reveal ${className ?? ""}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
}
