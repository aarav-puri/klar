"use client";
import { normalizeSchoologyHost } from "@klar/core/protocol";
import { Check, ExternalLink, Loader2, Puzzle, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { detectExtension } from "@/lib/extension-client";
import { syncErrorCopy, type ErrorCopy } from "@/lib/sync-errors";
import { runExtensionSync, runOfficialSync, type SyncSummary } from "@/lib/sync-client";
import { cn } from "@/lib/utils";

type Method = "extension" | "api";
type Step = "consent" | "extension" | "school" | "syncing" | "done";

const STEPS: { id: Step[]; label: string; methods: Method[] }[] = [
  { id: ["consent"], label: "Permission", methods: ["extension", "api"] },
  { id: ["extension"], label: "Extension", methods: ["extension"] },
  { id: ["school"], label: "Sign in", methods: ["extension", "api"] },
  { id: ["syncing"], label: "Sync", methods: ["extension", "api"] },
  { id: ["done"], label: "Ready", methods: ["extension", "api"] },
];

export interface OnboardingProps {
  /** Whether this server can also connect through the official Schoology API. */
  officialApi: boolean;
  storeUrl: string;
  existingHost: string | null;
  initial: { method?: Method; step?: string; error?: string };
}

/**
 * Connect Schoology: by default through the Klar extension (works for every
 * school, no API key), or through the official API when the server has one.
 */
export function Onboarding({ officialApi, storeUrl, existingHost, initial }: OnboardingProps) {
  const router = useRouter();
  const apiReturn = initial.method === "api" && initial.step === "sync";
  const [method, setMethod] = useState<Method>(initial.method === "api" && officialApi ? "api" : "extension");
  const [step, setStep] = useState<Step>(apiReturn ? "syncing" : initial.error ? "school" : "consent");
  const [consent, setConsent] = useState(Boolean(initial.error));
  const [host, setHost] = useState(existingHost ?? "");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<ErrorCopy | null>(initial.error ? syncErrorCopy(initial.error) : null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };

  const connectWithExtension = async (h: string) => {
    go("syncing");
    setProgress("Opening your Schoology gradebook");
    const out = await runExtensionSync({ kind: "connect", host: h }, (p) => setProgress(p.message));
    if (out.ok) {
      setSummary(out.summary);
      go("done");
    } else {
      setError(syncErrorCopy(out.code, out.message));
      setStep(out.code === "NOT_INSTALLED" ? "extension" : "school");
    }
  };

  const runApiSync = useCallback(async () => {
    setProgress("Reading your courses from Schoology");
    const out = await runOfficialSync();
    if (out.ok) {
      setSummary(out.summary);
      setStep("done");
    } else {
      setError(syncErrorCopy(out.code, out.message));
      setStep("school");
    }
  }, []);

  useEffect(() => {
    // Returning from Schoology's approval page: start the first server-side sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (apiReturn) void runApiSync();
  }, [apiReturn, runApiSync]);

  const activeIndex = STEPS.findIndex((s) => s.id.includes(step));

  return (
    <div className="mx-auto w-full max-w-xl">
      <ol className="mb-10 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => {
          if (!s.methods.includes(method)) return null;
          const state = i < activeIndex ? "done" : i === activeIndex ? "current" : "todo";
          return (
            <li key={s.label} className="flex flex-1 flex-col gap-2" aria-current={state === "current" ? "step" : undefined}>
              <span className={cn("h-1 rounded-full transition-colors duration-500", state === "todo" ? "bg-line" : "bg-brand")} />
              <span className={cn("text-xs font-semibold", state === "todo" ? "text-ink-3" : "text-ink")}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {step === "consent" && (
            <section>
              <h1 className="text-2xl font-extrabold tracking-tight">Connect your Schoology</h1>
              <p className="mt-2 text-ink-2">
                Sign in to Schoology as usual. Klar never sees your password.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-surface p-4">
                  <p className="text-sm font-bold">Reads</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                    {["Courses and teachers", "Assignments, due dates and scores", "Categories and weights", "Course grades"].map((t) => (
                      <li key={t} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-line bg-surface p-4">
                  <p className="text-sm font-bold">Never touches</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
                    {["Your Schoology password", "Login cookies", "Messages or files", "Anything outside your gradebook"].map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="mt-2 h-0.5 w-3 shrink-0 rounded bg-ink-3" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>


              {officialApi && (
                <fieldset className="mt-6">
                  <legend className="mb-2 text-sm font-bold">How should Klar connect?</legend>
                  <div className="grid gap-2">
                    <MethodOption
                      checked={method === "extension"}
                      onSelect={() => setMethod("extension")}
                      title="Browser extension"
                      tag="Works for any school"
                      body="Reads your gradebook after you sign in to Schoology."
                    />
                    <MethodOption
                      checked={method === "api"}
                      onSelect={() => setMethod("api")}
                      title="Official Schoology API"
                      tag="If your school allows it"
                      body="Approve Klar in Schoology. Some schools block this."
                    />
                  </div>
                </fieldset>
              )}

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
                <span className="text-sm">
                  Klar may read my Schoology grades and keep them in my account. I can disconnect and delete them anytime.
                </span>
              </label>
              <div className="mt-6 flex items-center gap-3">
                <Button size="lg" disabled={!consent} onClick={() => go(method === "extension" ? "extension" : "school")}>
                  Continue
                </Button>
                <Link href="/privacy" className="text-sm font-semibold text-ink-2 hover:text-ink">
                  Privacy Policy
                </Link>
              </div>
            </section>
          )}

          {step === "extension" && <ExtensionStep storeUrl={storeUrl} error={error} onReady={() => go("school")} />}

          {step === "school" && (
            <SchoolStep
              method={method}
              host={host}
              setHost={setHost}
              error={error}
              onSubmit={(h) => {
                if (method === "api") {
                  // Full navigation: the API route redirects on to the school's Schoology site.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.assign(`${window.location.origin}/api/schoology/oauth/start?host=${encodeURIComponent(h)}&consent=1`);
                } else {
                  void connectWithExtension(h);
                }
              }}
            />
          )}

          {step === "syncing" && (
            <section aria-live="polite">
              <Loader2 className="mb-6 size-8 animate-spin text-brand" />
              <h1 className="text-2xl font-extrabold tracking-tight">{progress || "Connecting"}</h1>
              <p className="mt-3 text-ink-2">
                {progress.startsWith("Sign in")
                  ? "Use your usual school login in the Schoology tab. Klar never sees your password. This page continues when you're done."
                  : "Keep this tab open."}
              </p>
              <p className="mt-3 text-sm text-ink-3">
                Seeing a PowerSchool page instead? The address is likely mistyped. Close that tab and check it.</p>
            </section>
          )}

          {step === "done" && summary && (
            <section>
              <div className="mb-6 flex size-10 items-center justify-center rounded-full bg-success-wash text-success">
                <Check className="size-5" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">You&rsquo;re connected</h1>
              <p className="mt-3 text-lg text-ink-2">
                Klar read {summary.courses} course{summary.courses === 1 ? "" : "s"} and {summary.assignments} assignment{summary.assignments === 1 ? "" : "s"}. Your grade history starts today.
              </p>
              <Button size="lg" className="mt-8" onClick={() => (router.push("/app"), router.refresh())}>
                Open my dashboard
              </Button>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MethodOption({ checked, onSelect, title, tag, body }: { checked: boolean; onSelect: () => void; title: string; tag: string; body: string }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-lg border bg-surface p-4 transition-colors", checked ? "border-brand shadow-[var(--ring)]" : "border-line hover:border-line-strong")}>
      <input type="radio" name="method" checked={checked} onChange={onSelect} className="mt-1 size-4 accent-[var(--brand)]" />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {title}
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs font-semibold text-ink-2">{tag}</span>
        </span>
        <span className="mt-0.5 block text-sm text-ink-2">{body}</span>
      </span>
    </label>
  );
}

function ErrorNote({ error }: { error: ErrorCopy }) {
  return (
    <div role="alert" className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-danger-wash px-4 py-3">
      <p className="text-sm font-bold text-danger">{error.title}</p>
      <p className="mt-0.5 text-sm text-ink-2">{error.recovery}</p>
    </div>
  );
}

function ExtensionStep({ storeUrl, error, onReady }: { storeUrl: string; error: ErrorCopy | null; onReady: () => void }) {
  const [state, setState] = useState<"checking" | "missing" | "found" | "unsupported">("checking");
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const chromium = typeof navigator !== "undefined" && /Chrome|Chromium|Edg\//.test(navigator.userAgent) && !/Mobile/.test(navigator.userAgent);
    const check = async () => {
      const v = await detectExtension();
      if (cancelled) return;
      if (v) {
        setVersion(v);
        setState("found");
      } else {
        setState(chromium ? "missing" : "unsupported");
        // Keep checking so the page moves on by itself after installation.
        setTimeout(check, 1500);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-extrabold tracking-tight">Add the Klar extension</h1>
      <p className="mt-2 text-ink-2">It only runs on your Schoology gradebook.</p>
      {error && <ErrorNote error={error} />}

      {state === "checking" && (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="size-4 animate-spin" /> Looking for the extension
        </p>
      )}

      {state === "found" && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-success">
            <Check className="size-4" /> Extension found{version ? ` (v${version})` : ""}
          </p>
          <Button size="lg" className="mt-4" onClick={onReady}>
            Continue
          </Button>
        </div>
      )}

      {state === "unsupported" && (
        <div className="mt-6 rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
          <p className="font-bold text-ink">This browser can&rsquo;t run the extension</p>
          <p className="mt-1">Use Chrome, Edge, Brave or Arc on a computer.</p>
        </div>
      )}

      {state === "missing" && (
        <ol className="mt-6 space-y-3">
          <InstallStep n={1} title="Install Klar for Schoology">
            {storeUrl ? (
              <Button asChild variant="secondary" size="sm" className="mt-2">
                <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                  <Puzzle /> Open Chrome Web Store <ExternalLink />
                </a>
              </Button>
            ) : (
              <p className="mt-1 text-sm text-ink-2">
                Development build: run <code className="rounded bg-surface-2 px-1 text-xs">npm run build:extension</code>, open <code className="rounded bg-surface-2 px-1 text-xs">chrome://extensions</code>, turn on Developer mode, choose Load unpacked and pick <code className="rounded bg-surface-2 px-1 text-xs">apps/extension/dist</code>.
              </p>
            )}
          </InstallStep>
          <InstallStep n={2} title="Check it's turned on">
            <p className="mt-1 text-sm text-ink-2">Already installed? Turn it on in chrome://extensions.</p>
          </InstallStep>
          <InstallStep n={3} title="Come back here">
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
              <Loader2 className="size-3.5 animate-spin" /> This page continues once it finds the extension. You may need to reload.
            </p>
          </InstallStep>
        </ol>
      )}
    </section>
  );
}

function InstallStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-lg border border-line bg-surface p-4">
      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-wash text-xs font-bold text-brand-ink">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {children}
      </div>
    </li>
  );
}

function SchoolStep({ method, host, setHost, error, onSubmit }: { method: Method; host: string; setHost: (h: string) => void; error: ErrorCopy | null; onSubmit: (host: string) => void }) {
  const id = useId();
  const [touched, setTouched] = useState(false);
  const normalized = normalizeSchoologyHost(host);
  const invalid = touched && host.trim() !== "" && !normalized;
  return (
    <section>
      <h1 className="text-2xl font-extrabold tracking-tight">What&rsquo;s your school&rsquo;s Schoology address?</h1>
      <p className="mt-2 text-ink-2">Copy it from your address bar while Schoology is open.</p>
      {error && <ErrorNote error={error} />}
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (normalized) onSubmit(normalized);
        }}
      >
        <Label htmlFor={id}>Schoology address</Label>
        <Input
          id={id}
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="yourschool.schoology.com"
          autoComplete="url"
          inputMode="url"
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          className="h-12 text-base"
        />
        <p id={`${id}-hint`} className={cn("mt-2 text-sm", invalid ? "text-danger" : "text-ink-3")}>
          {invalid ? "That's not a web address. Try something like lincoln.schoology.com." : "Usually ends in schoology.com."}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button size="lg" type="submit" disabled={!normalized}>
            {method === "api" ? "Continue to Schoology" : "Connect and sign in"}
          </Button>
          <span className="flex items-center gap-1.5 text-sm text-ink-2">
            <ShieldCheck className="size-4 text-success" /> You sign in on Schoology&rsquo;s own page
          </span>
        </div>
      </form>
    </section>
  );
}
