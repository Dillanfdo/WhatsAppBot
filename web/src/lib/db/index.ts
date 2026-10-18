import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { env } from "@/lib/env";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool = globalForDb.pool ?? new Pool({ connectionString: env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool);

export async function pingDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}
