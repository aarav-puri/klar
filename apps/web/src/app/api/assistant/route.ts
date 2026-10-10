import { streamText, isStepCount, tool, createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream, type ModelMessage } from "ai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, readJson, requireStudent } from "@/server/api";
import { ASSISTANT_MODEL, requiredScoreInput, runRequiredScore, runWhatIf, systemPrompt, whatIfInput } from "@/server/assistant";
import { asStudent } from "@/server/db";
import { getWorkspace } from "@/server/data/workspace";
import { assistantConfigured } from "@/server/env";
import { limiters } from "@/server/rate-limit";

export const maxDuration = 60;

/** Questions each student can ask per day (Pacific time). */
const DAILY_MESSAGES = 5;
const LIMIT_REPLY = "You've reached today's limit for Ask Klar. Come back tomorrow and I'll pick up where you left off.";

/** A normal Klar reply, so hitting the limit reads like any other answer. */
function reply(text: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: "limit" });
        writer.write({ type: "text-delta", id: "limit", delta: text });
        writer.write({ type: "text-end", id: "limit" });
      },
    }),
  });
}

// Only the text of earlier turns is accepted. Tool calls and results are never
// taken from the browser, so a client can't forge a calculation.
const body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()).max(50),
      }).loose(),
    )
    .min(1)
    .max(40),
});

export async function POST(req: NextRequest) {
  const guard = await requireStudent(req, limiters.assistant);
  if (!guard.ok) return guard.response;
  if (!assistantConfigured) return jsonError(503, "AI_NOT_CONFIGURED", "Ask Klar isn't set up on this server yet.");

  let parsed;
  try {
    parsed = body.safeParse(await readJson(req, 200_000));
  } catch {
    return jsonError(413, "TOO_LARGE", "That conversation is too long. Start a new chat.");
  }
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Couldn't read that message.");

  const messages: ModelMessage[] = parsed.data.messages
    .map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)
        .join("\n")
        .slice(0, 4000),
    }))
    .filter((m) => m.content.trim() !== "");
  if (messages.at(-1)?.role !== "user") return jsonError(400, "BAD_REQUEST", "Ask a question first.");

  const ws = await getWorkspace();
  if (!ws) return jsonError(401, "SIGNED_OUT", "Your session ended. Sign in again.");

  const allowed = await asStudent(guard.db, guard.userId, async (tx) => {
    const r = await tx.query<{ ok: boolean }>(`select klar.take_assistant_message($1) as ok`, [DAILY_MESSAGES]);
    return r.rows[0]?.ok === true;
  });
  if (!allowed) return reply(LIMIT_REPLY);

  const result = streamText({
    model: ASSISTANT_MODEL,
    instructions: systemPrompt(ws),
    messages,
    stopWhen: isStepCount(6),
    maxOutputTokens: 1500,
    tools: {
      requiredScore: tool({
        description:
          "Exact score needed on one assignment (existing ungraded one, or a new future one) to reach a target course grade. Uses Klar's grade engine.",
        inputSchema: requiredScoreInput,
        execute: async (input) => runRequiredScore(ws, input),
      }),
      whatIf: tool({
        description: "Projected course grade if the student got certain scores on existing or future assignments. Uses Klar's grade engine.",
        inputSchema: whatIfInput,
        execute: async (input) => runWhatIf(ws, input),
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, onError: () => "Ask Klar couldn't answer just now. Try again." }),
  });
}
