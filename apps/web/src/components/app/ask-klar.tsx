"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ThinkingOrb } from "thinking-orbs";
import { ArrowUp, Calculator, RotateCcw, Square } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KlarBot } from "./klar-bot";

function errorText(error: Error | undefined): string {
  if (!error) return "";
  try {
    const parsed = JSON.parse(error.message) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {}
  return "Ask Klar couldn't answer just now. Try again.";
}

/** **bold** inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith("**") && s.endsWith("**") ? <strong key={i}>{s.slice(2, -2)}</strong> : <Fragment key={i}>{s}</Fragment>));
}

/** Paragraphs and "-" lists. The model is asked for nothing fancier. */
function Rich({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="list-disc space-y-1 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = line.match(/^[-*•]\s+(.*)$/);
    if (item) list.push(item[1]!);
    else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
}

/** Thinking, or calculating once a grade tool is running. */
function Thinking({ calculating = false }: { calculating?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 py-1 text-sm font-semibold text-ink-2" role="status">
      <ThinkingOrb state={calculating ? "solving" : "composing"} size={20} color="#0677ba" aria-hidden />
      {calculating ? "Calculating" : "Thinking"}
    </span>
  );
}

function Message({ m, live }: { m: UIMessage; live: boolean }) {
  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const calculated = m.parts.some((p) => p.type.startsWith("tool-"));
  const calculating = live && !text && calculated;
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[0.95rem] whitespace-pre-wrap text-white">{text}</p>
      </div>
    );
  }
  return (
    <div className="flex max-w-[92%] gap-3">
      <span className="mt-0.5 shrink-0">
        <KlarBot size={32} working={live} />
      </span>
      <div className="min-w-0 pt-1 text-[0.95rem] leading-relaxed text-ink">
        {calculated && text && (
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
            <Calculator className="size-3.5" /> Calculated from your grades
          </p>
        )}
        {text ? <Rich text={text} /> : <Thinking calculating={calculating} />}
      </div>
    </div>
  );
}

export function AskKlar({ suggestions }: { suggestions: string[] }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, status]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    clearError();
    sendMessage({ text: q });
    setInput("");
  };

  const last = messages.at(-1);
  const waiting = busy && last?.role === "user";

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      <div className="flex-1 space-y-6 pb-6">
        {messages.length === 0 ? (
          <div className="pt-2">
            <div className="flex items-center gap-4">
              <KlarBot size={72} />
              <p className="text-ink-2">Ask about any class or score.</p>
            </div>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    className="h-full w-full rounded-lg border border-line bg-surface px-4 py-3 text-left text-sm font-semibold text-ink shadow-1 transition-colors hover:border-ink-3 hover:bg-surface-2"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} m={m} live={busy && m.id === last?.id && m.role === "assistant"} />)
        )}
        {waiting && (
          <div className="flex gap-3">
            <KlarBot size={32} working />
            <div className="pt-1">
              <Thinking />
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,var(--line))] bg-danger-wash px-4 py-3 text-sm text-danger">
            {errorText(error)}
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] bg-[var(--bg)] pt-3 pb-3 lg:bottom-0 lg:pb-6"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 shadow-1 focus-within:border-brand focus-within:shadow-[var(--ring)]">
          <label htmlFor="ask-input" className="sr-only">
            Ask Klar
          </label>
          <textarea
            id="ask-input"
            ref={box}
            rows={1}
            value={input}
            maxLength={2000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="What do I need on my next test to keep an A?"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[0.95rem] text-ink outline-none [field-sizing:content] placeholder:text-ink-3"
          />
          {messages.length > 0 && !busy && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="New chat"
              onClick={() => {
                setMessages([]);
                clearError();
                box.current?.focus();
              }}
            >
              <RotateCcw />
            </Button>
          )}
          {busy ? (
            <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => stop()}>
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()} className={cn(!input.trim() && "opacity-55")}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-ink-3">Klar can make mistakes. Check important info.</p>
      </form>
    </div>
  );
}
