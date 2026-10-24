import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const execFileAsync = promisify(execFile);

const defaultTestUrl = "postgres://postgres:postgres@localhost:5432/whatsappbot_test";

const databaseName = (databaseUrl: string): { adminUrl: string; name: string } => {
  const match = /^(postgres(?:ql)?:\/\/[^/]+)\/([^/?]+)/.exec(databaseUrl);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Cannot parse database url ${databaseUrl}`);
  }
  return { adminUrl: `${match[1]}/postgres`, name: match[2] };
};

export default async function setup(): Promise<void> {
  config({ path: path.resolve(process.cwd(), ".env.local") });
  const testUrl = process.env.TEST_DATABASE_URL ?? defaultTestUrl;
  if (!testUrl.includes("/whatsappbot_test")) {
    throw new Error(`TEST_DATABASE_URL must use the whatsappbot_test database, received ${testUrl}`);
  }

  const { adminUrl, name } = databaseName(testUrl);
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const existing = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (existing.rowCount === 0) {
    await admin.query(`create database ${name}`);
  }
  await admin.end();

  const pool = new pg.Pool({ connectionString: testUrl });
  await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "src/db/migrations") });
  await pool.end();

  await execFileAsync("npx", ["tsx", "src/scripts/seed.ts"], {
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
