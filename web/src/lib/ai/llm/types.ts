export type LlmRole = "user" | "assistant" | "tool";

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LlmUserMessage = {
  role: "user";
  content: string;
};

export type LlmAssistantMessage = {
  role: "assistant";
  content: string;
  toolCalls?: LlmToolCall[];
};

export type LlmToolMessage = {
  role: "tool";
  toolName: string;
  toolCallId?: string;
  content: string;
};

export type LlmMessage = LlmUserMessage | LlmAssistantMessage | LlmToolMessage;

export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LlmChatRequest = {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  signal?: AbortSignal;
};

export type LlmChatResponse = {
  text: string;
  toolCalls: LlmToolCall[];
  raw?: unknown;
};

export type LlmClient = {
  provider: "ollama" | "anthropic";
  model: string;
  chat: (request: LlmChatRequest) => Promise<LlmChatResponse>;
};

export class LlmUnavailableError extends Error {
  readonly code = "llm_unavailable";

  constructor(message = "The language model server is not reachable. Run `ollama serve`.") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export class LlmModelMissingError extends Error {
  readonly code = "llm_model_missing";

  constructor(readonly model: string) {
    super(`Model "${model}" is not installed. Run \`ollama pull ${model}\`.`);
    this.name = "LlmModelMissingError";
  }
}

export class LlmTimeoutError extends Error {
  readonly code = "llm_timeout";

  constructor(message = "The language model did not respond before the timeout.") {
    super(message);
    this.name = "LlmTimeoutError";
  }
}
