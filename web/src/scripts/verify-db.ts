import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });

const expectedTables = [
  "availability_exceptions",
  "availability_rules",
  "booking_resources",
  "bookings",
  "business_documents",
  "businesses",
  "conversations",
  "customers",
  "messages",
  "resources",
  "service_resource_requirements",
  "service_resources",
  "services",
];

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function queryInSavepoint(
  client: Client,
  savepoint: string,
  statement: string,
  params: unknown[] = [],
): Promise<{ ok: true } | { ok: false; code?: string; message: string }> {
  await client.query(`savepoint ${savepoint}`);
  try {
    await client.query(statement, params);
    await client.query(`release savepoint ${savepoint}`);
    return { ok: true };
  } catch (error) {
    await client.query(`rollback to savepoint ${savepoint}`);
    return { ok: false, code: pgErrorCode(error), message: errorMessage(error) };
  }
}

async function checkTables(client: Client): Promise<Check> {
  const result = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  const present = new Set(result.rows.map((row) => row.tablename));
  const missing = expectedTables.filter((table) => !present.has(table));
  return {
    name: "expected public tables exist",
    pass: missing.length === 0,
    detail: missing.length === 0 ? undefined : `missing ${missing.join(", ")}`,
  };
}

async function insertReturningId(client: Client, statement: string, params: unknown[] = []): Promise<string> {
  const result = await client.query<{ id: string }>(statement, params);
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Insert did not return an id: ${statement}`);
  }
  return id;
}

async function checkBookingOverlap(client: Client): Promise<Check[]> {
  const businessId = await insertReturningId(
    client,
    "insert into businesses (name, type) values ('Verify Cafe', 'cafe') returning id",
  );
  const resourceA = await insertReturningId(
    client,
    "insert into resources (business_id, type, name) values ($1, 'staff', 'Alex') returning id",
    [businessId],
  );
  const resourceB = await insertReturningId(
    client,
    "insert into resources (business_id, type, name) values ($1, 'room', 'Room 1') returning id",
    [businessId],
  );
  const customerId = await insertReturningId(
    client,
    "insert into customers (business_id, phone, name) values ($1, '+919876543210', 'Verify Customer') returning id",
    [businessId],
  );
  const serviceId = await insertReturningId(
    client,
    "insert into services (business_id, name, duration_min) values ($1, 'Consultation', 60) returning id",
    [businessId],
  );

  const rangeStart = "2026-10-20T10:00:00+05:30";
  const rangeEnd = "2026-10-20T11:00:00+05:30";
  const nextEnd = "2026-10-20T12:00:00+05:30";

  async function insertBooking(): Promise<string> {
    return insertReturningId(
      client,
      `insert into bookings (business_id, customer_id, service_id, starts_at, ends_at)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [businessId, customerId, serviceId, rangeStart, rangeEnd],
    );
  }

  const bookingA = await insertBooking();
  const bookingB = await insertBooking();
  const bookingBackToBack = await insertReturningId(
    client,
    `insert into bookings (business_id, customer_id, service_id, starts_at, ends_at)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [businessId, customerId, serviceId, rangeEnd, nextEnd],
  );

  const insertResource = `insert into booking_resources (booking_id, resource_id, during)
    values ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'))`;

  const first = await queryInSavepoint(client, "first_assignment", insertResource, [
    bookingA,
    resourceA,
    rangeStart,
    rangeEnd,
  ]);
  if (!first.ok) {
    return [
      {
        name: "overlap on the same resource is rejected with 23P01",
        pass: false,
        detail: first.message,
      },
      {
        name: "overlap on a different resource succeeds",
        pass: false,
        detail: "skipped because the first assignment failed",
      },
      {
        name: "back-to-back ranges succeed",
        pass: false,
        detail: "skipped because the first assignment failed",
      },
      {
        name: "overlap succeeds after the existing row is inactive",
        pass: false,
        detail: "skipped because the first assignment failed",
      },
    ];
  }

  const sameResource = await queryInSavepoint(client, "overlap_same", insertResource, [
    bookingB,
    resourceA,
    rangeStart,
    rangeEnd,
  ]);
  const differentResource = await queryInSavepoint(client, "overlap_other", insertResource, [
    bookingB,
    resourceB,
    rangeStart,
    rangeEnd,
  ]);
  const backToBack = await queryInSavepoint(client, "back_to_back", insertResource, [
    bookingBackToBack,
    resourceA,
    rangeEnd,
    nextEnd,
  ]);

  const deactivated = await queryInSavepoint(
    client,
    "deactivate",
    "update booking_resources set active = false where booking_id = $1 and resource_id = $2",
    [bookingA, resourceA],
  );

  const bookingAfterInactive = await insertReturningId(
    client,
    `insert into bookings (business_id, customer_id, service_id, starts_at, ends_at)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [businessId, customerId, serviceId, rangeStart, rangeEnd],
  );
  const afterInactive = deactivated.ok
    ? await queryInSavepoint(client, "overlap_inactive", insertResource, [
        bookingAfterInactive,
        resourceA,
        rangeStart,
        rangeEnd,
      ])
    : { ok: false as const, message: deactivated.message };

  return [
    {
      name: "overlap on the same resource is rejected with 23P01",
      pass: !sameResource.ok && sameResource.code === "23P01",
      detail: sameResource.ok ? "insert succeeded" : `${sameResource.code ?? "no SQLSTATE"}: ${sameResource.message}`,
    },
    {
      name: "overlap on a different resource succeeds",
      pass: differentResource.ok,
      detail: differentResource.ok ? undefined : differentResource.message,
    },
    {
      name: "back-to-back ranges succeed",
      pass: backToBack.ok,
      detail: backToBack.ok ? undefined : backToBack.message,
    },
    {
      name: "overlap succeeds after the existing row is inactive",
      pass: afterInactive.ok,
      detail: afterInactive.ok ? undefined : afterInactive.message,
    },
  ];
}

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("FAIL DATABASE_URL is available");
    return 1;
  }

  const client = new Client({ connectionString: databaseUrl });
  const checks: Check[] = [];

  try {
    await client.connect();
    await client.query("begin");
    checks.push(await checkTables(client));
    checks.push(...(await checkBookingOverlap(client)));
    await client.query("rollback");

    const leftover = await client.query<{ count: string }>(
      "select count(*)::text as count from businesses where name = 'Verify Cafe'",
    );
    checks.push({
      name: "verification rows were rolled back",
      pass: leftover.rows[0]?.count === "0",
      detail: `remaining rows ${leftover.rows[0]?.count ?? "unknown"}`,
    });
  } catch (error) {
    checks.push({
      name: "verification transaction",
      pass: false,
      detail: errorMessage(error),
    });
    try {
      await client.query("rollback");
    } catch {
      // The connection may already be closed or idle.
    }
  } finally {
    await client.end();
  }

  let failed = false;
  for (const check of checks) {
    const suffix = check.detail ? ` (${check.detail})` : "";
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${suffix}`);
    if (!check.pass) {
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

void main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.log(`FAIL verification script crashed (${errorMessage(error)})`);
    process.exit(1);
  });
