import type { AgentToolTrace } from "@/lib/validation";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolTrace[];
  model?: string;
  provider?: string;
  debugError?: string;
};

export const PHONE_PRESETS = [
  { id: "one", label: "Customer One", phone: "+919999900001" },
  { id: "two", label: "Customer Two", phone: "+919999900002" },
  { id: "custom", label: "Custom", phone: "" },
] as const;
