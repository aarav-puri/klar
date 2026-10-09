import {
  Calculator,
  Check,
  ChartLine,
  CircleAlert,
  GraduationCap,
  LayoutGrid,
  Lock,
  X,
} from "lucide-react";
import Link from "next/link";
import { KlarBot } from "@/components/app/klar-bot";
import { Shot } from "@/components/marketing/shot";
import { nbButton } from "@/components/marketing/nb";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { getViewer } from "@/server/viewer";

/** Signed-in visitors get "Go to dashboard" instead of the connect button. */
export default async function LandingPage() {
  const signedIn = (await getViewer()).kind === "user";
  const cta = signedIn
    ? { href: "/app", label: "Go to dashboard" }
    : { href: "/connect", label: "Connect Schoology" };

  return (
    <div className="bg-nb-card text-nb-text">
      <SiteNav signedIn={signedIn} />
      <main id="main">
        {/* Hero */}
        <section className="nb-dots relative overflow-hidden border-b-2 border-nb-line bg-nb-pop">
          <div
            aria-hidden
            className="nb-glow pointer-events-none absolute inset-0"
          />
          <div className="relative mx-auto max-w-4xl px-5 py-20 text-center sm:px-8 lg:py-28">
            <div className="flex flex-col items-center">
              <span className="nb-enter nb-border inline-flex items-center gap-2 rounded-full bg-nb-card py-1 pr-4 pl-2 text-sm font-bold">
                <KlarBot size={28} interactive={false} />
                New: Ask Klar
              </span>
              <h1
                className="nb-enter mt-6 text-[clamp(3.2rem,9vw,7rem)] leading-[0.92] font-extrabold tracking-tighter"
                style={{ ["--d" as string]: "90ms" }}
              >
                Your grades. Finally,{" "}
                <span className="nb-outline nb-outline-sheen">clear.</span>
              </h1>
              <p
                className="nb-enter mt-6 max-w-xl text-lg font-medium text-nb-muted sm:text-xl"
                style={{ ["--d" as string]: "200ms" }}
              >
                Every Schoology class, your GPA, and what you need on the next
                test.
              </p>
              <div
                className="nb-enter mt-9 flex flex-wrap justify-center gap-4"
                style={{ ["--d" as string]: "300ms" }}
              >
                <Link href={cta.href} className={nbButton.primary}>
                  {cta.label}
                </Link>
                <a href="#how" className={nbButton.secondary}>
                  How it works
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Feature marquee */}
        <div
          className="overflow-hidden border-b-2 border-nb-line bg-nb-dark py-5"
          aria-hidden
        >
          <div className="nb-fade-x">
            <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-12 pr-12">
              {[...MARQUEE, ...MARQUEE].map((t, i) => (
                <span
                  key={i}
                  className="font-display text-2xl font-extrabold whitespace-nowrap text-nb-accent opacity-50 dark:text-nb-pop"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Before and after */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="max-w-2xl text-4xl font-extrabold tracking-tighter sm:text-5xl">
              Stop clicking through every class.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            <Reveal className="rounded-3xl border-2 border-dashed border-ink-3 bg-surface-2 p-8 opacity-70">
              <p className="font-display text-2xl font-extrabold">
                Without Klar
              </p>
              <ul className="mt-6 space-y-4 font-bold">
                {[
                  "A tab for every class",
                  "Guessing what you need",
                  "No record of changes",
                  "Missing work buried",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <X
                      className="size-5 shrink-0 text-danger"
                      strokeWidth={3}
                    />{" "}
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal
              delay={150}
              className="nb-border nb-shadow-lg nb-grad-card rounded-3xl p-8"
            >
              <p className="font-display text-2xl font-extrabold">With Klar</p>
              <ul className="mt-6 space-y-4 font-bold">
                {[
                  "Every class on one screen",
                  "The exact score you need",
                  "History from your first sync",
                  "Missing work flagged",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="nb-border flex size-6 shrink-0 items-center justify-center rounded-md bg-nb-card">
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="scroll-mt-20 border-y-2 border-nb-line bg-nb-pop py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <h2 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">
                Features
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, body, bot, shot, fit }, i) => (
                <Reveal key={title} delay={(i % 2) * 100}>
                  <div className="group nb-border nb-shadow nb-lift flex h-full flex-col overflow-hidden rounded-2xl bg-nb-card">
                    <Shot
                      name={shot}
                      alt={`${title} in Klar`}
                      fit={fit}
                      className="aspect-[16/10] border-b-2 border-nb-line bg-bg"
                      sizes="(min-width: 1152px) 540px, (min-width: 768px) 50vw, 100vw"
                    />
                    <div className="p-6">
                      <div className="flex items-center gap-3">
                        <span className="nb-border flex size-10 shrink-0 items-center justify-center rounded-lg bg-nb-accent transition-colors group-hover:bg-nb-pop">
                          {bot ? <KlarBot size={34} /> : Icon ? <Icon className="nb-wiggle size-5" /> : null}
                        </span>
                        <h3 className="text-2xl font-extrabold tracking-tight">{title}</h3>
                      </div>
                      <p className="mt-3 font-medium text-nb-muted">{body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="scroll-mt-20 border-y-2 border-nb-line bg-nb-dark py-24 text-white"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <h2 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">
                Set up in a minute.
              </h2>
            </Reveal>
            <Reveal
              as="ol"
              className="relative mt-16 grid gap-12 md:grid-cols-3"
            >
              <span
                className="absolute top-12 right-[16%] left-[16%] hidden h-0.5 bg-[#272727] md:block"
                aria-hidden
              >
                <span className="nb-grad-line nb-draw block h-full" />
              </span>
              {STEPS.map(([title, body], i) => (
                <li
                  key={title}
                  className="relative flex flex-col items-center text-center"
                >
                  <span
                    className="nb-pop-in flex size-24 items-center justify-center rounded-full border-4 bg-nb-dark font-display text-4xl font-extrabold"
                    style={{
                      borderColor: ["var(--nb-accent)", "#9fd3f5", "#ffffff"][
                        i
                      ],
                      ["--d" as string]: `${200 + i * 250}ms`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <p className="mt-6 font-display text-2xl font-extrabold">
                    {title}
                  </p>
                  <p className="mt-2 max-w-60 font-medium text-white/65">
                    {body}
                  </p>
                </li>
              ))}
            </Reveal>
            <p className="mt-14 flex items-center justify-center gap-2 text-sm font-bold text-white/65">
              <Lock className="size-4" /> Klar never sees your Schoology
              password.
            </p>
          </div>
        </section>

        {/* Moments */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">
              When you&rsquo;ll open Klar.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {MOMENTS.map(({ tag, title, className }, i) => (
              <Reveal
                key={tag}
                delay={i * 110}
                className={`nb-border flex min-h-56 flex-col rounded-3xl p-7 ${className}`}
              >
                <span className="nb-border w-fit rounded-full bg-white px-3 py-1 text-sm font-bold text-[#0b1622]">
                  {tag}
                </span>
                <p className="mt-auto pt-10 font-display text-3xl leading-tight font-extrabold tracking-tight">
                  {title}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section
          id="privacy"
          className="scroll-mt-20 border-y-2 border-nb-line bg-nb-accent py-24"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-extrabold tracking-tighter sm:text-5xl">
                Your grades are yours.
              </h2>
              <Link
                href="/privacy"
                className="font-bold underline decoration-2 underline-offset-4"
              >
                Privacy Policy
              </Link>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY.map(([title, body], i) => (
                <Reveal key={title} delay={i * 90}>
                  <div className="nb-border nb-shadow nb-lift h-full rounded-tl-[2px] rounded-tr-3xl rounded-br-[2px] rounded-bl-3xl bg-nb-card p-6">
                    <p className="font-display text-xl font-extrabold">
                      {title}
                    </p>
                    <p className="mt-2 font-medium text-nb-muted">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="nb-grad-cta relative overflow-hidden border-t-2 border-nb-line py-24 text-center">
          <div
            aria-hidden
            className="nb-dots pointer-events-none absolute inset-0"
          />
          <Reveal className="relative mx-auto max-w-3xl px-5 sm:px-8">
            <h2 className="text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.95] font-extrabold tracking-tighter">
              See every grade clearly.
            </h2>
            <div className="mt-9 flex justify-center">
              <Link href={cta.href} className={nbButton.primary}>
                {cta.label}
              </Link>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const MARQUEE = [
  "Exact grades",
  "Unweighted GPA",
  "What-if",
  "Score needed",
  "Ask Klar",
  "Grade history",
  "Missing work",
];

const FEATURES = [
  { icon: LayoutGrid, title: "Every class", body: "Exact grades and categories, side by side.", shot: "courses", fit: "contain" as const },
  { icon: GraduationCap, title: "Your GPA", body: "Unweighted, on a 4.0 scale.", shot: "gpa", fit: "contain" as const },
  { icon: Calculator, title: "What-if", body: "Try a score. See your grade move.", shot: "whatif", fit: "contain" as const },
  { icon: null, bot: true, title: "Ask Klar", body: "Ask anything about your grades.", shot: "ask", fit: "contain" as const },
  { icon: ChartLine, title: "History", body: "Every change, from your first sync.", shot: "history", fit: "contain" as const },
  { icon: CircleAlert, title: "Missing work", body: "Only what your teacher marks missing.", shot: "workload", fit: "contain" as const },
];

const STEPS: [string, string][] = [
  ["Create an account", "An email and a Klar password."],
  ["Add the extension", "Sign in to Schoology as usual."],
  ["Sync", "Your grades, ready in seconds."],
];

const MOMENTS = [
  {
    tag: "Before a test",
    title: "Know the score you need.",
    className: "bg-nb-accent",
  },
  {
    tag: "After a grade posts",
    title: "See exactly what changed.",
    className: "nb-shadow-lg nb-grad-card",
  },
  {
    tag: "End of semester",
    title: "Check your GPA in one look.",
    className: "bg-[#272727] text-white",
  },
];

const PRIVACY: [string, string][] = [
  ["No password", "Klar never asks for your Schoology password."],
  ["Only you", "No one else sees your grades."],
  ["Read-only", "Klar can't change anything in Schoology."],
  ["Delete anytime", "Remove everything in Settings."],
];
