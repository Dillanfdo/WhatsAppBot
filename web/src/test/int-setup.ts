import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: path.resolve(root, ".env.local") });

const testUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/whatsappbot_test";

if (!testUrl.includes("/whatsappbot_test")) {
  throw new Error(`Refusing to run integration tests against ${testUrl}`);
}

process.env.DATABASE_URL = testUrl;
process.env.LLM_PROVIDER ??= "ollama";
process.env.MAX_TOOL_CALLS_PER_MESSAGE ??= "5";
