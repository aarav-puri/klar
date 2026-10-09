import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A product screenshot from public/screenshots, captured from the real app
 * with fictional example courses (npm run screenshots). Light and dark
 * versions swap with the theme.
 */
export function Shot({ name, alt, className, fit = "cover", sizes, priority }: { name: string; alt: string; className?: string; fit?: "cover" | "contain"; sizes: string; priority?: boolean }) {
  const img = fit === "cover" ? "object-cover object-left-top" : "object-contain object-center p-3";
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image src={`/screenshots/${name}-light.png`} alt={alt} fill sizes={sizes} priority={priority} className={cn(img, "dark:hidden")} />
      <Image src={`/screenshots/${name}-dark.png`} alt={alt} fill sizes={sizes} priority={priority} className={cn(img, "hidden dark:block")} />
    </div>
  );
}
