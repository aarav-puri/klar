"use client";
import { BotAvatar } from "bot-avatars";

/** Ask Klar's face: a round bot in Klar blue, echoing the Klar disc. Crisp
 * shading: the default fabric fur reads as blurry at small sizes. */
export function KlarBot({ size, working = false, interactive = true }: { size: number; working?: boolean; interactive?: boolean }) {
  return (
    <BotAvatar
      type="circle"
      color="#0677ba"
      shading="crisp"
      size={size}
      state={working ? "working" : "default"}
      interactive={interactive}
      aria-label="Ask Klar"
    />
  );
}
