import "server-only";
import { env } from "@/lib/env";
import { parseToolCalls } from "@/lib/ai/llm/parse";
import {
  LlmTimeoutError,
  LlmUnavailableError,
  type LlmChatRequest,
  type LlmChatResponse,
  type LlmClient,
  type LlmMessage,
} from "@/lib/ai/llm/types";

type NvidiaToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type NvidiaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: NvidiaToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export const toNvidiaMessages = (system: string, messages: LlmMessage[]): NvidiaMessage[] => {
  const converted: NvidiaMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "user") {
      converted.push({ role: "user", content: message.content });
      continue;
    }
    if (message.role === "tool") {
      converted.push({
        role: "tool",
        tool_call_id: message.toolCallId ?? message.toolName,
        content: message.content,
      });
      continue;
    }
    const toolCalls = message.toolCalls ?? [];
    converted.push({
      role: "assistant",
      content: message.content.length > 0 ? message.content : null,
      ...(toolCalls.length > 0
        ? {
            tool_calls: toolCalls.map(
              (call): NvidiaToolCall => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: JSON.stringify(call.arguments) },
              }),
            ),
          }
        : {}),
    });
  }
  return converted;
};

/** Drops a leading reasoning block so the customer only sees the answer. */
export const visibleReply = (text: string): string => text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, "").trim();

const readText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .flatMap((part) => {
      if (typeof part === "string") {
        return [part];
      }
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return [part.text];
      }
      return [];
    })
    .join("");
};

const readChoice = (raw: unknown): { text: string; toolCalls: unknown } => {
  if (!raw || typeof raw !== "object" || !("choices" in raw) || !Array.isArray(raw.choices)) {
    return { text: "", toolCalls: undefined };
  }
  const first = raw.choices[0];
  if (!first || typeof first !== "object" || !("message" in first) || !first.message || typeof first.message !== "object") {
    return { text: "", toolCalls: undefined };
  }
  const message = first.message;
  const content = "content" in message ? message.content : "";
  const toolCalls = "tool_calls" in message ? message.tool_calls : undefined;
  return { text: readText(content), toolCalls };
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

export class NvidiaLlm implements LlmClient {
  readonly provider = "nvidia" as const;
  readonly model = env.NVIDIA_MODEL;

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    const apiKey = env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new LlmUnavailableError("LLM_PROVIDER=nvidia but NVIDIA_API_KEY is missing.");
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, env.NVIDIA_TIMEOUT_MS);
    const onCallerAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      const response = await fetch(`${env.NVIDIA_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: env.LLM_TEMPERATURE,
          max_tokens: 1024,
          stream: false,
          parallel_tool_calls: true,
          chat_template_kwargs: { enable_thinking: false },
          messages: toNvidiaMessages(request.system, request.messages),
          tools: request.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          })),
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new LlmUnavailableError("NVIDIA rejected the API key.");
        }
        if (response.status === 404) {
          throw new LlmUnavailableError(`NVIDIA does not serve model "${this.model}".`);
        }
        if (response.status === 429) {
          throw new LlmUnavailableError("NVIDIA rate limit reached. Wait a moment and try again.");
        }
        throw new Error(`NVIDIA chat failed (${response.status}): ${bodyText}`);
      }

      const raw: unknown = bodyText.length > 0 ? JSON.parse(bodyText) : {};
      const choice = readChoice(raw);
      return {
        text: visibleReply(choice.text),
        toolCalls: parseToolCalls(choice.toolCalls),
        raw,
      };
    } catch (error) {
      if (error instanceof LlmUnavailableError) {
        throw error;
      }
      if (timedOut) {
        throw new LlmTimeoutError();
      }
      if (request.signal?.aborted) {
        throw error;
      }
      if (isConnectionFailure(error)) {
        throw new LlmUnavailableError("NVIDIA is not reachable.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onCallerAbort);
    }
  }
}
