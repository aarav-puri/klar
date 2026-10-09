"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KlarLogo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { nbButton } from "./nb";

const LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
];

export function SiteNav({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const cta = signedIn ? { href: "/app", label: "Go to dashboard" } : { href: "/connect", label: "Connect Schoology" };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-nb-line bg-nb-pop text-nb-text">
      <nav aria-label="Main" className="mx-auto flex h-20 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="Klar home" className="rounded-md">
          <KlarLogo />
        </Link>
        <ul className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-sm font-bold hover:underline hover:decoration-2 hover:underline-offset-4">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {!signedIn && (
            <Link href="/login" className="hidden text-sm font-bold hover:underline hover:decoration-2 hover:underline-offset-4 sm:block">
              Sign in
            </Link>
          )}
          <Link href={cta.href} className={`${nbButton.small} hidden sm:inline-flex`}>
            {cta.label}
          </Link>
          <button
            className="nb-border inline-flex size-10 items-center justify-center rounded-lg bg-nb-card md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t-2 border-nb-line bg-nb-card px-5 py-3 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 font-bold">
              {l.label}
            </a>
          ))}
          <div className="mt-2 grid gap-3 border-t-2 border-nb-line pt-4 pb-2">
            {!signedIn && (
              <Link href="/login" className={nbButton.secondary}>
                Sign in
              </Link>
            )}
            <Link href={cta.href} className={nbButton.primary}>
              {cta.label}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
