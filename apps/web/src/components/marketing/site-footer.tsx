import Link from "next/link";
import { KlarSymbol } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-nb-dark text-white">
      <div className="mx-auto max-w-6xl px-5 pt-16 pb-10 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <span className="inline-flex size-12 items-center justify-center rounded-lg border-2 border-white/20 bg-white">
              <KlarSymbol className="size-7" />
            </span>
            <p className="mt-4 max-w-xs text-sm text-white/70">Your Schoology grades, made clear.</p>
          </div>
          <FooterCol title="Product" links={[["Features", "/#features"], ["How it works", "/#how"]]} />
          <FooterCol title="Account" links={[["Sign in", "/login"], ["Connect Schoology", "/connect"], ["Forgot password", "/forgot-password"]]} />
          <FooterCol title="Trust" links={[["Privacy Policy", "/privacy"], ["Delete your data", "/privacy#delete"]]} />
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t-2 border-white/15 pt-6 text-xs text-white/55 sm:flex-row sm:justify-between">
          <p className="shrink-0">&copy; {new Date().getFullYear()} Klar. All rights reserved.</p>
          <p className="sm:text-right">Not affiliated with Schoology or PowerSchool.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-display text-lg font-extrabold">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-white/70 hover:text-nb-pop">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
