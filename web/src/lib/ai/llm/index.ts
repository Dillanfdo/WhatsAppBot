import "server-only";
import { env } from "@/lib/env";
import { AnthropicLlm } from "@/lib/ai/llm/anthropic";
import { NvidiaLlm } from "@/lib/ai/llm/nvidia";
import { OllamaLlm } from "@/lib/ai/llm/ollama";
import type { LlmClient } from "@/lib/ai/llm/types";

let cached: LlmClient | undefined;

export const getLlm = (): LlmClient => {
  if (!cached) {
    if (env.LLM_PROVIDER === "anthropic") {
      cached = new AnthropicLlm();
    } else if (env.LLM_PROVIDER === "nvidia") {
      cached = new NvidiaLlm();
    } else {
      cached = new OllamaLlm();
    }
  }
  return cached;
};

export { checkLlm } from "@/lib/ai/llm/health";
export type { LlmHealth } from "@/lib/ai/llm/health";
