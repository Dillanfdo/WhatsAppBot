import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const main = async () => {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  config({ path: path.resolve(scriptDir, "../../.env.local"), quiet: true });
  const { checkLlm, formatLlmHealth } = await import("../lib/ai/llm/health");
  const health = await checkLlm();
  process.stdout.write(`${formatLlmHealth(health)}\n`);
  process.exit(health.reachable && health.modelInstalled && health.toolSupport !== false ? 0 : 1);
};

void main();
