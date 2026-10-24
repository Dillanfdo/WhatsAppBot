import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import {
  LlmTimeoutError,
  type LlmChatRequest,
  type LlmChatResponse,
  type LlmClient,
  type LlmMessage,
  type LlmToolCall,
} from "@/lib/ai/llm/types";

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
};

const toAnthropicMessages = (messages: LlmMessage[]): AnthropicMessage[] => {
  const converted: AnthropicMessage[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      converted.push({ role: "user", content: message.content });
      continue;
    }
    if (message.role === "assistant") {
      const blocks: AnthropicContent[] = [];
      if (message.content.trim().length > 0) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.arguments,
        });
      }
      converted.push({
        role: "assistant",
        content: blocks.length > 0 ? blocks : message.content,
      });
      continue;
    }

    const result: AnthropicContent = {
      type: "tool_result",
      tool_use_id: message.toolCallId ?? message.toolName,
      content: message.content,
    };
    const previous = converted.at(-1);
    if (previous?.role === "user" && Array.isArray(previous.content)) {
      previous.content.push(result);
    } else {
      converted.push({ role: "user", content: [result] });
    }
  }
  return converted;
};

const readToolCalls = (content: Anthropic.Message["content"]): LlmToolCall[] =>
  content.flatMap((block) => {
    if (block.type !== "tool_use") {
      return [];
    }
    const input =
      block.input && typeof block.input === "object" && !Array.isArray(block.input)
        ? (block.input as Record<string, unknown>)
        : {};
    return [{ id: block.id, name: block.name, arguments: input }];
  });

const readText = (content: Anthropic.Message["content"]): string =>
  content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("");

export class AnthropicLlm implements LlmClient {
  readonly provider = "anthropic" as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor() {
    const apiKey = env.ANTHROPIC_API_KEY;
    const model = env.ANTHROPIC_MODEL_DEFAULT;
    if (!apiKey || !model) {
      throw new Error("Anthropic is selected but ANTHROPIC_API_KEY or ANTHROPIC_MODEL_DEFAULT is missing");
    }
    this.model = model;
    this.client = new Anthropic({ apiKey });
  }

  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    try {
      const message = await this.create(this.model, request);
      return this.toResponse(message);
    } catch (error) {
      if (this.isTimeout(error)) {
        throw new LlmTimeoutError();
      }
      const fallback = env.ANTHROPIC_MODEL_FALLBACK;
      if (!fallback || fallback === this.model || request.signal?.aborted) {
        throw error;
      }
      const message = await this.create(fallback, request);
      return this.toResponse(message);
    }
  }

  private async create(model: string, request: LlmChatRequest): Promise<Anthropic.Message> {
    return this.client.messages.create(
      {
        model,
        max_tokens: 1024,
        temperature: env.LLM_TEMPERATURE,
        system: request.system,
        tools: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Tool.InputSchema,
        })),
        messages: toAnthropicMessages(request.messages),
      },
      { signal: request.signal },
    );
  }

  private toResponse(message: Anthropic.Message): LlmChatResponse {
    return {
      text: readText(message.content),
      toolCalls: readToolCalls(message.content),
      raw: message,
    };
  }

  private isTimeout(error: unknown): boolean {
    return error instanceof Error && (error.name === "TimeoutError" || error.name === "APIConnectionTimeoutError");
  }
}
