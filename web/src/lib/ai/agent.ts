import "server-only";
import type { AgentResult, ChatRequest } from "@/lib/validation";

export type { AgentResult };

export async function runAgent(input: ChatRequest): Promise<AgentResult> {
  // TODO: load business config, buildSystemPrompt, run Anthropic tool-calling loop
  // TODO: cap iterations with env.MAX_TOOL_CALLS_PER_MESSAGE
  // Never take business_id or customer identity from model output; use input.storeId / input.phone
  return {
    reply: input.message,
    toolCalls: [],
  };
}
