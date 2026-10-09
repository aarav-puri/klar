"use client";
import { greeting } from "@/lib/format";
import { useClientOnly } from "@/lib/use-local-setting";

/** Uses the student's local clock, not the server's. */
export function Greeting({ name }: { name: string | null }) {
  const text = useClientOnly(() => greeting());
  return (
    <h1 className="text-3xl font-extrabold tracking-tighter text-ink sm:text-4xl">
      <span className={text ? "" : "opacity-0"}>{text ?? "Hello"}</span>
      {name ? (
        <>
          , <span className="klar-name-gradient">{name}</span>
        </>
      ) : null}
    </h1>
  );
}
