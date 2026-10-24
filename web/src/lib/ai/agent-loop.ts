import type { LlmClient, LlmMessage, LlmToolDefinition } from "@/lib/ai/llm/types";
import { claimsMutation } from "@/lib/ai/confirm";

export type ToolHandlerResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: string; message: string; hint?: string } };

export type LoopTrace = {
  name: string;
  input: unknown;
  output: unknown;
  ok: boolean;
  durationMs: number;
};

export type LoopResult = {
  reply: string;
  traces: LoopTrace[];
  debugError?: string;
};

const MUTATING = new Set(["create_booking", "cancel_booking", "reschedule_booking"]);

export const fallbackReply = (contactPhone: string | null): string =>
  contactPhone
    ? `I couldn't complete that. Let me connect you with the team: ${contactPhone}`
    : "I couldn't complete that. Please contact the store.";

const successfulMutation = (traces: LoopTrace[]): boolean =>
  traces.some((trace) => trace.ok && MUTATING.has(trace.name));

export async function runToolLoop(input: {
  llm: LlmClient;
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  maxCalls: number;
  contactPhone: string | null;
  execute: (name: string, args: Record<string, unknown>) => Promise<ToolHandlerResult>;
  onAssistant?: (message: { content: string; toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] }) => Promise<void>;
}): Promise<LoopResult> {
  const messages = [...input.messages];
  const traces: LoopTrace[] = [];
  let system = input.system;
  let groundedRetry = false;

  for (let round = 0; round < input.maxCalls + 2; round += 1) {
    const response = await input.llm.chat({ system, messages, tools: input.tools });
    if (response.toolCalls.length === 0) {
      if (claimsMutation(response.text) && !successfulMutation(traces) && !groundedRetry) {
        groundedRetry = true;
        system = `${input.system}\n\nCorrective note: do not say a booking was booked, confirmed, cancelled, or rescheduled unless a tool just succeeded.`;
        messages.push({ role: "assistant", content: response.text });
        messages.push({
          role: "user",
          content: "That last reply claimed a change that did not happen. Reply again without claiming it.",
        });
        continue;
      }
      if (claimsMutation(response.text) && !successfulMutation(traces)) {
        return {
          reply: fallbackReply(input.contactPhone),
          traces,
          debugError: "ungrounded_claim",
        };
      }
      return { reply: response.text, traces };
    }

    const assistantCalls: LlmMessage = {
      role: "assistant",
      content: response.text,
      toolCalls: response.toolCalls,
    };
    messages.push(assistantCalls);
    if (input.onAssistant && response.toolCalls.length > 0) {
      await input.onAssistant({ content: response.text, toolCalls: response.toolCalls });
    }

    for (const call of response.toolCalls) {
      if (traces.length >= input.maxCalls) {
        return {
          reply: fallbackReply(input.contactPhone),
          traces,
          debugError: "tool_cap",
        };
      }
      const started = Date.now();
      const result = await input.execute(call.name, call.arguments);
      const durationMs = Date.now() - started;
      traces.push({
        name: call.name,
        input: call.arguments,
        output: result,
        ok: result.ok,
        durationMs,
      });
      if (process.env.NODE_ENV === "development") {
        console.info(JSON.stringify({ tool: call.name, durationMs, ok: result.ok }));
      }
      messages.push({
        role: "tool",
        toolName: call.name,
        toolCallId: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: fallbackReply(input.contactPhone),
    traces,
    debugError: "tool_cap",
  };
}
