import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(__dirname, ".env.local") });

const testUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/whatsappbot_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.int.test.ts"],
    fileParallelism: false,
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/int-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: testUrl,
      LLM_PROVIDER: "ollama",
      MAX_TOOL_CALLS_PER_MESSAGE: "5",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/empty-module.ts"),
    },
  },
});
