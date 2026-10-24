import type { LlmToolCall } from "@/lib/ai/llm/types";

export const parseToolArguments = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);
    return parseToolArguments(parsed);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Tool arguments must be a JSON object");
};

export const modelIsInstalled = (installed: readonly string[], model: string): boolean =>
  installed.some((name) => name === model || name === `${model}:latest`);

type RawToolCall = {
  id?: unknown;
  function?: {
    name?: unknown;
    arguments?: unknown;
  };
};

export const parseToolCalls = (value: unknown): LlmToolCall[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    const call = item as RawToolCall;
    const name = call.function?.name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("Tool call is missing a function name");
    }
    const id = typeof call.id === "string" && call.id.length > 0 ? call.id : `call_${index}_${name}`;
    return {
      id,
      name,
      arguments: parseToolArguments(call.function?.arguments ?? {}),
    };
  });
};
