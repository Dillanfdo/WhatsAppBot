import "server-only";
import { env } from "@/lib/env";
import { runToolLoop, type LoopTrace } from "@/lib/ai/agent-loop";
import { renderConfirmation, type ConfirmationKind } from "@/lib/ai/confirm";
import {
  appendMessage,
  createConversation,
  findConversation,
  findDuplicateReply,
  historyToLlm,
  loadHistory,
} from "@/lib/ai/conversations";
import { getLlm } from "@/lib/ai/llm";
import {
  LlmModelMissingError,
  LlmTimeoutError,
  LlmUnavailableError,
  type LlmClient,
} from "@/lib/ai/llm/types";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { agentToolDefinitions, executeTool } from "@/lib/ai/tools";
import { BookingError } from "@/lib/booking/errors";
import { toE164 } from "@/lib/phone";
import type { AgentResult, ChatRequest } from "@/lib/validation";

const MUTATION_KIND: Record<string, ConfirmationKind> = {
  create_booking: "booked",
  cancel_booking: "cancelled",
  reschedule_booking: "rescheduled",
};

const privacyLine = "You can ask me for the Privacy Policy or Terms any time.";

const withPrivacyNote = (reply: string, firstTurn: boolean): string => {
  if (!firstTurn || /privacy policy/i.test(reply)) {
    return reply;
  }
  return `${reply}\n\n${privacyLine}`;
};

const confirmationFromTrace = (
  trace: LoopTrace,
  windowHours: number,
): string | null => {
  const kind = MUTATION_KIND[trace.name];
  if (!trace.ok || !kind) {
    return null;
  }
  const output = trace.output as {
    ok?: boolean;
    data?: {
      bookingId?: string;
      serviceName?: string;
      localLabel?: string;
      partySize?: number;
      price?: string;
      status?: string;
    };
  };
  const data = output.data;
  if (!data?.bookingId || !data.serviceName || !data.localLabel || data.partySize === undefined || !data.price || !data.status) {
    return null;
  }
  return renderConfirmation(
    kind,
    {
      id: data.bookingId,
      serviceName: data.serviceName,
      localLabel: data.localLabel,
      partySize: data.partySize,
      price: data.price,
      status: data.status as "held" | "confirmed" | "cancelled" | "completed" | "no_show",
    },
    windowHours,
  );
};

const emptyResult = (
  reply: string,
  extra: Partial<AgentResult> & Pick<AgentResult, "conversationId" | "model" | "provider">,
): AgentResult => ({
  reply,
  toolCalls: [],
  ...extra,
});

export async function runAgent(
  input: ChatRequest,
  deps?: { llm?: LlmClient },
): Promise<AgentResult> {
  const llm = deps?.llm ?? getLlm();
  let phone: string;
  try {
    phone = toE164(input.phone);
  } catch (error) {
    const message = error instanceof BookingError ? error.message : "Enter a valid phone number.";
    return emptyResult(message, {
      conversationId: input.sessionId ?? "00000000-0000-4000-8000-000000000000",
      model: llm.model,
      provider: llm.provider,
      debugError: "invalid_phone",
    });
  }

  if (input.messageId) {
    const duplicate = await findDuplicateReply(input.storeId, phone, input.messageId);
    if (duplicate) {
      return emptyResult(duplicate.reply, {
        conversationId: duplicate.conversationId,
        model: llm.model,
        provider: llm.provider,
      });
    }
  }

  const existing = await findConversation({
    storeId: input.storeId,
    phone,
    sessionId: input.sessionId,
  });
  const conversationId = existing?.id ?? (await createConversation(input.storeId, phone));
  const prior = await loadHistory(conversationId);
  const firstTurn = !prior.some((message) => message.role === "user");
  await appendMessage({
    conversationId,
    role: "user",
    content: { text: input.message },
    providerMessageId: input.messageId,
  });

  let prompt: Awaited<ReturnType<typeof buildSystemPrompt>>;
  try {
    prompt = await buildSystemPrompt(input.storeId);
  } catch {
    return emptyResult("That store was not found.", {
      conversationId,
      model: llm.model,
      provider: llm.provider,
      debugError: "not_found",
    });
  }

  const history = historyToLlm(await loadHistory(conversationId));
  try {
    const loop = await runToolLoop({
      llm,
      system: prompt.system,
      messages: history,
      tools: agentToolDefinitions,
      maxCalls: env.MAX_TOOL_CALLS_PER_MESSAGE,
      contactPhone: prompt.contactPhone,
      onAssistant: async (message) => {
        await appendMessage({
          conversationId,
          role: "assistant",
          content: { text: message.content, toolCalls: message.toolCalls },
        });
      },
      execute: async (name, args) => {
        const result = await executeTool(name, args, {
          storeId: input.storeId,
          phone,
          conversationId,
        });
        await appendMessage({
          conversationId,
          role: "tool",
          content: { name, input: args, output: result, ok: result.ok },
        });
        return result;
      },
    });

    const mutation = [...loop.traces].reverse().find((trace) => confirmationFromTrace(trace, prompt.cancellationWindowHours));
    const confirmed = mutation ? confirmationFromTrace(mutation, prompt.cancellationWindowHours) : null;
    const reply = confirmed ?? withPrivacyNote(loop.reply, firstTurn);
    await appendMessage({
      conversationId,
      role: "assistant",
      content: { text: reply },
    });
    return {
      reply,
      conversationId,
      model: llm.model,
      provider: llm.provider,
      toolCalls: loop.traces,
      ...(loop.debugError ? { debugError: loop.debugError } : {}),
    };
  } catch (error) {
    const debugError =
      error instanceof LlmUnavailableError || error instanceof LlmModelMissingError || error instanceof LlmTimeoutError
        ? error.code
        : "llm_error";
    const reply =
      error instanceof LlmUnavailableError || error instanceof LlmModelMissingError
        ? error.message
        : error instanceof LlmTimeoutError
          ? "The assistant took too long to reply. Please try again in a moment."
          : `I couldn't complete that. Let me connect you with the team: ${prompt.contactPhone ?? "the store"}.`;
    await appendMessage({
      conversationId,
      role: "assistant",
      content: { text: reply },
    });
    return {
      reply,
      conversationId,
      model: llm.model,
      provider: llm.provider,
      toolCalls: [],
      debugError,
    };
  }
}
