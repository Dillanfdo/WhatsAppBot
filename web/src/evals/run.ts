import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import path from "node:path";

const main = async () => {
  config({ path: ".env.local", quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL ?? "";
  if (!testUrl.includes("/whatsappbot_test")) {
    console.error("TEST_DATABASE_URL must point at whatsappbot_test");
    process.exit(1);
  }
  process.env.DATABASE_URL = testUrl;

  const runsFlag = process.argv.findIndex((arg) => arg === "--runs");
  const runs = Math.max(1, Number(runsFlag >= 0 ? process.argv[runsFlag + 1] : 1) || 1);
  const { evalCases } = await import("./cases");
  const { runCase } = await import("./runner");
  const cases = evalCases();

  const totals = new Map<string, { pass: number; fail: number; reasons: string[] }>();
  for (const item of cases) totals.set(item.id, { pass: 0, fail: 0, reasons: [] });

  for (let run = 1; run <= runs; run += 1) {
    console.log(`run ${run}/${runs}`);
    for (const item of cases) {
      const result = await runCase(item);
      const bucket = totals.get(item.id);
      if (!bucket) continue;
      if (result.pass) bucket.pass += 1;
      else {
        bucket.fail += 1;
        bucket.reasons.push(result.reasons.join("; "));
      }
      console.log(`${result.pass ? "pass" : "fail"} ${item.id} ${result.tools.join(",")}`);
    }
  }

  const report = [...totals.entries()].map(([id, bucket]) => ({
    id,
    pass: bucket.pass,
    fail: bucket.fail,
    rate: bucket.pass / runs,
    reasons: bucket.reasons,
  }));
  const passed = report.reduce((sum, row) => sum + row.pass, 0);
  const total = report.length * runs;
  console.log(`pass rate ${passed}/${total}`);
  writeFileSync(path.join(process.cwd(), "src/evals/last-report.json"), JSON.stringify({ runs, passed, total, report }, null, 2));
};

void main();
