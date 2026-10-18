import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL_DEFAULT: z.string().min(1),
  ANTHROPIC_MODEL_FALLBACK: z.string().min(1),
  MAX_TOOL_CALLS_PER_MESSAGE: z.coerce.number().int().positive(),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL_DEFAULT: process.env.ANTHROPIC_MODEL_DEFAULT,
  ANTHROPIC_MODEL_FALLBACK: process.env.ANTHROPIC_MODEL_FALLBACK,
  MAX_TOOL_CALLS_PER_MESSAGE: process.env.MAX_TOOL_CALLS_PER_MESSAGE,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;
