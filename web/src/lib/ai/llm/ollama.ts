import "server-only";
import { env } from "@/lib/env";
import { parseToolCalls } from "@/lib/ai/llm/parse";
import {
  LlmModelMissingError,
  LlmTimeoutError,
  LlmUnavailableError,
  type LlmChatRequest,
  type LlmChatResponse,
  type LlmClient,
  type LlmMessage,
} from "@/lib/ai/llm/types";

type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: Record<string, unknown> };
  }[];
  tool_name?: string;
};

const toOllamaMessages = (system: string, messages: LlmMessage[]): OllamaMessage[] => {
  const ollamaMessages: OllamaMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "user") {
      ollamaMessages.push({ role: "user", content: message.content });
      continue;
    }
    if (message.role === "tool") {
      ollamaMessages.push({
        role: "tool",
        content: message.content,
        tool_name: message.toolName,
      });
      continue;
    }
    const toolCalls = message.toolCalls ?? [];
    ollamaMessages.push({
      role: "assistant",
      content: message.content,
      ...(toolCalls.length > 0
        ? {
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    });
  }
  return ollamaMessages;
};

const causeCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return undefined;
  }
  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) {
    return undefined;
  }
  return typeof cause.code === "string" ? cause.code : undefined;
};

const isConnectionFailure = (error: unknown): boolean => {
  const code = causeCode(error);
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ECONNRESET" || code === "EAI_AGAIN") {
    return true;
  }
  return error instanceof TypeError && /fetch failed/i.test(error.message);
};

export class OllamaLlm implements LlmClient {
  readonly provider = "ollama" as const;
  readonly model = env.OLLAMA_MODEL;

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, env.OLLAMA_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          stream: false,
          messages: toOllamaMessages(request.system, request.messages),
          tools: request.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
          options: {
            temperature: env.LLM_TEMPERATURE,
            num_ctx: env.OLLAMA_NUM_CTX,
          },
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        if (response.status === 404 || /not found/i.test(bodyText)) {
          throw new LlmModelMissingError(env.OLLAMA_MODEL);
        }
        throw new Error(`Ollama chat failed (${response.status}): ${bodyText}`);
      }

      const raw: unknown = bodyText.length > 0 ? JSON.parse(bodyText) : {};
      const message =
        raw && typeof raw === "object" && "message" in raw
          ? (raw.message as { content?: unknown; tool_calls?: unknown })
          : undefined;
      const text = typeof message?.content === "string" ? message.content : "";
      return {
        text,
        toolCalls: parseToolCalls(message?.tool_calls),
        raw,
      };
    } catch (error) {
      if (error instanceof LlmModelMissingError || error instanceof LlmUnavailableError) {
        throw error;
      }
      if (timedOut) {
        throw new LlmTimeoutError();
      }
      if (request.signal?.aborted) {
        throw error;
      }
      if (isConnectionFailure(error)) {
        throw new LlmUnavailableError();
      }
      throw error;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onCallerAbort);
    }
  }
}
