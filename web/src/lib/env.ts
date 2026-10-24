import "server-only";
import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length === 0 ? undefined : trimmed;
  });

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    LLM_PROVIDER: z.enum(["ollama", "anthropic"]).default("ollama"),
    OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
    OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b"),
    OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(8192),
    OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    MAX_TOOL_CALLS_PER_MESSAGE: z.coerce.number().int().positive().default(5),
    TEST_DATABASE_URL: z
      .string()
      .min(1)
      .default("postgres://postgres:postgres@localhost:5432/whatsappbot_test"),
    ANTHROPIC_API_KEY: optionalText,
    ANTHROPIC_MODEL_DEFAULT: optionalText,
    ANTHROPIC_MODEL_FALLBACK: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.LLM_PROVIDER !== "anthropic") {
      return;
    }
    if (!value.ANTHROPIC_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic",
      });
    }
    if (!value.ANTHROPIC_MODEL_DEFAULT) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_MODEL_DEFAULT"],
        message: "ANTHROPIC_MODEL_DEFAULT is required when LLM_PROVIDER=anthropic",
      });
    }
    if (!value.ANTHROPIC_MODEL_FALLBACK) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_MODEL_FALLBACK"],
        message: "ANTHROPIC_MODEL_FALLBACK is required when LLM_PROVIDER=anthropic",
      });
    }
  });

const blankToUndefined = (value: string | undefined): string | undefined => {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value;
};

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  LLM_PROVIDER: blankToUndefined(process.env.LLM_PROVIDER),
  OLLAMA_BASE_URL: blankToUndefined(process.env.OLLAMA_BASE_URL),
  OLLAMA_MODEL: blankToUndefined(process.env.OLLAMA_MODEL),
  OLLAMA_NUM_CTX: blankToUndefined(process.env.OLLAMA_NUM_CTX),
  OLLAMA_TIMEOUT_MS: blankToUndefined(process.env.OLLAMA_TIMEOUT_MS),
  LLM_TEMPERATURE: blankToUndefined(process.env.LLM_TEMPERATURE),
  MAX_TOOL_CALLS_PER_MESSAGE: blankToUndefined(process.env.MAX_TOOL_CALLS_PER_MESSAGE),
  TEST_DATABASE_URL: blankToUndefined(process.env.TEST_DATABASE_URL),
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL_DEFAULT: process.env.ANTHROPIC_MODEL_DEFAULT,
  ANTHROPIC_MODEL_FALLBACK: process.env.ANTHROPIC_MODEL_FALLBACK,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
