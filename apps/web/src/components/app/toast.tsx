"use client";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; title: string; body?: string; tone: "neutral" | "success" | "danger" };
type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] };
const Ctx = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(Ctx);
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { tone: "neutral", ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5200);
  }, []);
  return (
    <Ctx value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[60] flex flex-col items-end gap-2 lg:bottom-6" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pointer-events-auto w-full max-w-sm rounded-lg border border-line bg-surface px-4 py-3 shadow-2"
            >
              <p className={cn("text-sm font-bold", t.tone === "success" && "text-success", t.tone === "danger" && "text-danger")}>{t.title}</p>
              {t.body ? <p className="mt-0.5 text-sm text-ink-2">{t.body}</p> : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx>
  );
}
