import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { inArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { DateTime } from "luxon";
import { Pool } from "pg";
import {
  availabilityExceptions,
  availabilityRules,
  bookingResources,
  bookings,
  businessDocuments,
  businesses,
  conversations,
  customers,
  messages,
  resources,
  serviceResourceRequirements,
  serviceResources,
  services,
} from "../lib/db/schema";
import { parseHHMM } from "../lib/time";
import {
  SEED_CURRENCY,
  SEED_IDS,
  SEED_SLOT_INTERVAL_MIN,
  SEED_TIMEZONE,
  findSeedService,
  sampleBookings,
  sampleCustomers,
  seedStores,
  seededBusinessIds,
  type SampleBooking,
  type SeedException,
  type SeedStore,
} from "./seed-data";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(scriptDir, "../../.env.local"), quiet: true });

type Db = NodePgDatabase;
type Check = { name: string; pass: boolean; detail?: string };

const businessIds: string[] = [...seededBusinessIds];

function errorText(error: unknown): string {
  if (error instanceof AggregateError) {
    const parts = error.errors.map((item) => errorText(item)).filter((part) => part.length > 0);
    return parts.join("; ") || error.message || error.name;
  }
  if (error instanceof Error) {
    const cause = error.cause ? `: ${errorText(error.cause)}` : "";
    return `${error.message}${cause}` || error.name;
  }
  return String(error);
}

function databaseHost(databaseUrl: string): string {
  return new URL(databaseUrl).hostname;
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

function toPgTime(hhmm: string): string {
  const { hour, minute } = parseHHMM(hhmm);
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
}

function requireIso(value: string | null, label: string): string {
  if (!value) {
    throw new Error(`Could not format ${label}`);
  }
  return value;
}

function exceptionWindow(spec: SeedException, now: DateTime): { startsAt: Date; endsAt: Date } {
  const day = now.setZone(SEED_TIMEZONE).plus({ days: spec.daysFromNow }).startOf("day");
  if (spec.kind === "full_day") {
    return { startsAt: day.toJSDate(), endsAt: day.plus({ days: 1 }).toJSDate() };
  }
  const start = parseHHMM(spec.start);
  const end = parseHHMM(spec.end);
  const startsAt = day.set({ hour: start.hour, minute: start.minute, second: 0, millisecond: 0 });
  const endsAt = day.set({ hour: end.hour, minute: end.minute, second: 0, millisecond: 0 });
  return { startsAt: startsAt.toJSDate(), endsAt: endsAt.toJSDate() };
}

class IntegrityCheckError extends Error {
  constructor() {
    super("Integrity checks failed");
    this.name = "IntegrityCheckError";
  }
}

async function clearSeed(tx: Db): Promise<void> {
  const conversationIds = tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(inArray(conversations.businessId, businessIds));
  await tx.delete(messages).where(inArray(messages.conversationId, conversationIds));
  await tx.delete(conversations).where(inArray(conversations.businessId, businessIds));

  const bookingIds = tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.businessId, businessIds));
  await tx.delete(bookingResources).where(inArray(bookingResources.bookingId, bookingIds));
  await tx.delete(bookings).where(inArray(bookings.businessId, businessIds));
  await tx.delete(customers).where(inArray(customers.businessId, businessIds));

  const serviceIds = tx
    .select({ id: services.id })
    .from(services)
    .where(inArray(services.businessId, businessIds));
  await tx.delete(serviceResources).where(inArray(serviceResources.serviceId, serviceIds));
  await tx
    .delete(serviceResourceRequirements)
    .where(inArray(serviceResourceRequirements.serviceId, serviceIds));
  await tx.delete(services).where(inArray(services.businessId, businessIds));

  await tx.delete(availabilityExceptions).where(inArray(availabilityExceptions.businessId, businessIds));
  await tx.delete(availabilityRules).where(inArray(availabilityRules.businessId, businessIds));
  await tx.delete(resources).where(inArray(resources.businessId, businessIds));
  await tx.delete(businessDocuments).where(inArray(businessDocuments.businessId, businessIds));
  await tx.delete(businesses).where(inArray(businesses.id, businessIds));
}

async function insertStores(tx: Db, now: DateTime): Promise<void> {
  const seededAt = now.toJSDate();

  await tx.insert(businesses).values(
    seedStores.map((store) => ({
      id: store.id,
      name: store.name,
      type: store.type,
      description: store.description,
      address: store.address,
      timezone: SEED_TIMEZONE,
      slotIntervalMin: SEED_SLOT_INTERVAL_MIN,
      contactPhone: store.contactPhone,
      ownerWhatsapp: store.ownerWhatsapp,
      config: store.config,
      isActive: true,
    })),
  );

  await tx.insert(resources).values(
    seedStores.flatMap((store) =>
      store.resources.map((resource) => ({
        id: resource.id,
        businessId: store.id,
        type: resource.type,
        name: resource.name,
        capacity: resource.capacity,
        isActive: true,
      })),
    ),
  );

  await tx.insert(services).values(
    seedStores.flatMap((store) =>
      store.services.map((service) => ({
        id: service.id,
        businessId: store.id,
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        bufferAfterMin: service.bufferAfterMin,
        priceCents: service.priceCents,
        currency: SEED_CURRENCY,
        minParty: service.minParty,
        maxParty: service.maxParty,
        intakeQuestions: service.intakeQuestions,
        isActive: true,
      })),
    ),
  );

  await tx.insert(serviceResourceRequirements).values(
    seedStores.flatMap((store) =>
      store.services.flatMap((service) =>
        service.requirements.map((requirement) => ({
          serviceId: service.id,
          resourceType: requirement.resourceType,
          quantity: requirement.quantity,
        })),
      ),
    ),
  );

  const restricted = seedStores.flatMap((store) =>
    store.services.flatMap((service) =>
      (service.resourceIds ?? []).map((resourceId) => ({
        serviceId: service.id,
        resourceId,
      })),
    ),
  );
  if (restricted.length > 0) {
    await tx.insert(serviceResources).values(restricted);
  }

  await tx.insert(availabilityRules).values(
    seedStores.flatMap((store) =>
      store.rules.flatMap((rule) =>
        rule.weekdays.map((weekday) => ({
          businessId: store.id,
          resourceId: rule.resourceId,
          weekday,
          startTime: toPgTime(rule.start),
          endTime: toPgTime(rule.end),
        })),
      ),
    ),
  );

  const exceptionRows = seedStores.flatMap((store) =>
    store.exceptions.map((spec) => {
      const window = exceptionWindow(spec, now);
      return {
        businessId: store.id,
        resourceId: spec.resourceId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        isOpen: false,
        reason: spec.reason,
      };
    }),
  );
  if (exceptionRows.length > 0) {
    await tx.insert(availabilityExceptions).values(exceptionRows);
  }

  await tx.insert(businessDocuments).values(
    seedStores.flatMap((store) =>
      store.documents.map((document) => ({
        businessId: store.id,
        type: document.type,
        title: document.title,
        content: document.content,
        version: 1,
        effectiveFrom: seededAt,
      })),
    ),
  );

  await tx.insert(customers).values(
    seedStores.flatMap((store) =>
      sampleCustomers.map((customer) => ({
        businessId: store.id,
        phone: customer.phone,
        name: customer.name,
        consentAt: seededAt,
      })),
    ),
  );
}

async function insertSampleBookings(tx: Db, now: DateTime): Promise<void> {
  const customerRows = await tx
    .select({
      id: customers.id,
      businessId: customers.businessId,
      phone: customers.phone,
    })
    .from(customers)
    .where(inArray(customers.businessId, businessIds));

  for (const spec of sampleBookings) {
    await insertSampleBooking(tx, now, spec, customerRows);
  }
}

async function insertSampleBooking(
  tx: Db,
  now: DateTime,
  spec: SampleBooking,
  customerRows: { id: string; businessId: string; phone: string }[],
): Promise<void> {
  const service = findSeedService(spec.serviceId);
  const store = seedStores.find((item) => item.id === spec.businessId);
  const resource = store?.resources.find((item) => item.id === spec.resourceId);
  if (!store || !resource || resource.capacity < spec.partySize) {
    throw new Error(`Sample booking resource ${spec.resourceId} cannot take the party`);
  }
  if (spec.partySize < service.minParty || spec.partySize > service.maxParty) {
    throw new Error(`Sample booking party size is outside ${service.name}`);
  }

  const customer = customerRows.find(
    (row) => row.businessId === spec.businessId && row.phone === spec.customerPhone,
  );
  if (!customer) {
    throw new Error(`Sample booking customer ${spec.customerPhone} is missing`);
  }

  const clock = parseHHMM(spec.start);
  const start = now.setZone(SEED_TIMEZONE).plus({ days: 1 }).set({
    hour: clock.hour,
    minute: clock.minute,
    second: 0,
    millisecond: 0,
  });
  const endsAt = start.plus({ minutes: service.durationMin });
  const rangeEnd = endsAt.plus({ minutes: service.bufferAfterMin });

  const [booking] = await tx
    .insert(bookings)
    .values({
      businessId: spec.businessId,
      customerId: customer.id,
      serviceId: spec.serviceId,
      startsAt: start.toJSDate(),
      endsAt: endsAt.toJSDate(),
      partySize: spec.partySize,
      status: "confirmed",
      idempotencyKey: spec.idempotencyKey,
    })
    .returning({ id: bookings.id });

  if (!booking) {
    throw new Error(`Sample booking for ${service.name} did not return an id`);
  }

  const startIso = requireIso(start.toISO(), "booking start");
  const rangeEndIso = requireIso(rangeEnd.toISO(), "booking range end");
  await tx.insert(bookingResources).values({
    bookingId: booking.id,
    resourceId: spec.resourceId,
    during: sql`tstzrange(${startIso}::timestamptz, ${rangeEndIso}::timestamptz, '[)')`,
    active: true,
  });
}

type ServiceRow = {
  id: string;
  businessId: string;
  name: string;
  durationMin: number;
  minParty: number;
  maxParty: number;
  isActive: boolean;
};

type ResourceRow = {
  id: string;
  businessId: string;
  type: string;
  name: string;
  capacity: number;
  isActive: boolean;
};

function timeText(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

async function runChecks(tx: Db): Promise<Check[]> {
  const serviceRows: ServiceRow[] = await tx
    .select({
      id: services.id,
      businessId: services.businessId,
      name: services.name,
      durationMin: services.durationMin,
      minParty: services.minParty,
      maxParty: services.maxParty,
      isActive: services.isActive,
    })
    .from(services)
    .where(inArray(services.businessId, businessIds));

  const requirementRows = await tx
    .select({
      serviceId: serviceResourceRequirements.serviceId,
      resourceType: serviceResourceRequirements.resourceType,
      quantity: serviceResourceRequirements.quantity,
    })
    .from(serviceResourceRequirements)
    .where(
      inArray(
        serviceResourceRequirements.serviceId,
        serviceRows.map((service) => service.id),
      ),
    );

  const resourceRows: ResourceRow[] = await tx
    .select({
      id: resources.id,
      businessId: resources.businessId,
      type: resources.type,
      name: resources.name,
      capacity: resources.capacity,
      isActive: resources.isActive,
    })
    .from(resources)
    .where(inArray(resources.businessId, businessIds));

  const restrictionRows = await tx
    .select({
      serviceId: serviceResources.serviceId,
      resourceId: serviceResources.resourceId,
    })
    .from(serviceResources)
    .where(
      inArray(
        serviceResources.serviceId,
        serviceRows.map((service) => service.id),
      ),
    );

  const ruleRows = await tx
    .select({
      businessId: availabilityRules.businessId,
      resourceId: availabilityRules.resourceId,
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(inArray(availabilityRules.businessId, businessIds));

  const documentRows = await tx
    .select({
      businessId: businessDocuments.businessId,
      type: businessDocuments.type,
    })
    .from(businessDocuments)
    .where(inArray(businessDocuments.businessId, businessIds));

  return [
    checkServices(serviceRows, requirementRows, resourceRows, restrictionRows),
    checkRules(ruleRows),
    checkStoreMinimums(serviceRows, resourceRows, ruleRows, documentRows),
    checkRestrictions(serviceRows, requirementRows, resourceRows, restrictionRows),
  ];
}

function checkServices(
  serviceRows: ServiceRow[],
  requirementRows: { serviceId: string; resourceType: string; quantity: number }[],
  resourceRows: ResourceRow[],
  restrictionRows: { serviceId: string; resourceId: string }[],
): Check {
  const name =
    "every active service has duration, a requirement, and a resource that fits the party";
  const problems: string[] = [];

  for (const service of serviceRows.filter((row) => row.isActive)) {
    if (service.durationMin <= 0) {
      problems.push(`${service.name} has no positive duration`);
    }
    const requirements = requirementRows.filter((row) => row.serviceId === service.id);
    if (requirements.length === 0) {
      problems.push(`${service.name} has no requirement row`);
      continue;
    }
    const allowedIds = restrictionRows
      .filter((row) => row.serviceId === service.id)
      .map((row) => row.resourceId);

    for (const requirement of requirements) {
      const eligible = resourceRows.filter((resource) => {
        if (!resource.isActive || resource.businessId !== service.businessId) {
          return false;
        }
        if (resource.type !== requirement.resourceType) {
          return false;
        }
        if (allowedIds.length > 0 && !allowedIds.includes(resource.id)) {
          return false;
        }
        return true;
      });
      // Fail when no eligible resource can hold max_party. A smaller table does not satisfy it.
      const fitsParty = eligible.filter((resource) => resource.capacity >= service.maxParty);
      if (eligible.length < requirement.quantity || fitsParty.length === 0) {
        problems.push(
          `${service.name} needs ${requirement.quantity} ${requirement.resourceType} with capacity >= ${service.maxParty}`,
        );
      }
    }
  }

  return { name, pass: problems.length === 0, detail: problems.join("; ") || undefined };
}

function checkRules(
  ruleRows: {
    businessId: string;
    resourceId: string | null;
    weekday: number;
    startTime: string;
    endTime: string;
  }[],
): Check {
  const name = "availability rules on the same weekday do not overlap";
  const groups = new Map<string, { start: string; end: string }[]>();
  for (const rule of ruleRows) {
    const key = `${rule.businessId}|${rule.resourceId ?? ""}|${rule.weekday}`;
    const windows = groups.get(key) ?? [];
    windows.push({ start: timeText(rule.startTime), end: timeText(rule.endTime) });
    groups.set(key, windows);
  }

  const problems: string[] = [];
  for (const [key, windows] of groups) {
    const sorted = [...windows].sort((a, b) => a.start.localeCompare(b.start));
    for (let index = 0; index < sorted.length; index += 1) {
      const window = sorted[index];
      if (!window || window.end <= window.start) {
        problems.push(`${key} has end_time <= start_time`);
        continue;
      }
      const previous = sorted[index - 1];
      if (previous && window.start < previous.end) {
        problems.push(`${key} overlaps ${previous.start}-${previous.end} and ${window.start}-${window.end}`);
      }
    }
  }

  return { name, pass: problems.length === 0, detail: problems.join("; ") || undefined };
}

function checkStoreMinimums(
  serviceRows: ServiceRow[],
  resourceRows: ResourceRow[],
  ruleRows: { businessId: string }[],
  documentRows: { businessId: string; type: string }[],
): Check {
  const name = "each store has a resource, a service, a weekly rule, and core documents";
  const requiredDocs = ["privacy", "terms", "cancellation"];
  const problems: string[] = [];

  for (const store of seedStores) {
    if (!resourceRows.some((row) => row.businessId === store.id)) {
      problems.push(`${store.name} has no resource`);
    }
    if (!serviceRows.some((row) => row.businessId === store.id)) {
      problems.push(`${store.name} has no service`);
    }
    if (!ruleRows.some((row) => row.businessId === store.id)) {
      problems.push(`${store.name} has no weekly rule`);
    }
    const types = new Set(
      documentRows.filter((row) => row.businessId === store.id).map((row) => row.type),
    );
    for (const type of requiredDocs) {
      if (!types.has(type)) {
        problems.push(`${store.name} is missing ${type}`);
      }
    }
  }

  return { name, pass: problems.length === 0, detail: problems.join("; ") || undefined };
}

function checkRestrictions(
  serviceRows: ServiceRow[],
  requirementRows: { serviceId: string; resourceType: string }[],
  resourceRows: ResourceRow[],
  restrictionRows: { serviceId: string; resourceId: string }[],
): Check {
  const name = "restricted services point at a resource of the required type in the same business";
  const problems: string[] = [];
  const servicesById = new Map(serviceRows.map((service) => [service.id, service]));
  const resourcesById = new Map(resourceRows.map((resource) => [resource.id, resource]));

  for (const link of restrictionRows) {
    const service = servicesById.get(link.serviceId);
    const resource = resourcesById.get(link.resourceId);
    if (!service || !resource) {
      problems.push(`restriction ${link.serviceId} -> ${link.resourceId} is missing a row`);
      continue;
    }
    if (resource.businessId !== service.businessId) {
      problems.push(`${service.name} points at a resource in another business`);
    }
    const requiredTypes = requirementRows
      .filter((row) => row.serviceId === service.id)
      .map((row) => row.resourceType);
    if (!requiredTypes.includes(resource.type)) {
      problems.push(`${service.name} points at ${resource.name}, type ${resource.type}`);
    }
  }

  return { name, pass: problems.length === 0, detail: problems.join("; ") || undefined };
}

function printChecks(checks: Check[]): void {
  for (const check of checks) {
    const suffix = check.detail ? ` (${check.detail})` : "";
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${suffix}`);
  }
}

async function printSummary(db: Db): Promise<void> {
  const resourceRows = await db
    .select({ businessId: resources.businessId })
    .from(resources)
    .where(inArray(resources.businessId, businessIds));
  const serviceRows = await db
    .select({ businessId: services.businessId })
    .from(services)
    .where(inArray(services.businessId, businessIds));
  const ruleRows = await db
    .select({ businessId: availabilityRules.businessId })
    .from(availabilityRules)
    .where(inArray(availabilityRules.businessId, businessIds));
  const exceptionRows = await db
    .select({ businessId: availabilityExceptions.businessId })
    .from(availabilityExceptions)
    .where(inArray(availabilityExceptions.businessId, businessIds));
  const documentRows = await db
    .select({ businessId: businessDocuments.businessId })
    .from(businessDocuments)
    .where(inArray(businessDocuments.businessId, businessIds));
  const customerRows = await db
    .select({ businessId: customers.businessId })
    .from(customers)
    .where(inArray(customers.businessId, businessIds));
  const bookingRows = await db
    .select({ id: bookings.id, businessId: bookings.businessId })
    .from(bookings)
    .where(inArray(bookings.businessId, businessIds));
  const bookingResourceRows =
    bookingRows.length === 0
      ? []
      : await db
          .select({ bookingId: bookingResources.bookingId })
          .from(bookingResources)
          .where(
            inArray(
              bookingResources.bookingId,
              bookingRows.map((row) => row.id),
            ),
          );

  const count = (rows: { businessId: string }[], store: SeedStore) =>
    rows.filter((row) => row.businessId === store.id).length;

  for (const store of seedStores) {
    console.log(`${store.name} (${store.id})`);
    console.log(`  resources: ${count(resourceRows, store)}`);
    console.log(`  services: ${count(serviceRows, store)}`);
    console.log(`  rules: ${count(ruleRows, store)}`);
    console.log(`  exceptions: ${count(exceptionRows, store)}`);
    console.log(`  documents: ${count(documentRows, store)}`);
    console.log(`  customers: ${count(customerRows, store)}`);
  }

  console.log(`bookings: ${bookingRows.length}`);
  console.log(`booking_resources: ${bookingResourceRows.length}`);
  console.log("SEED_IDS");
  console.log(JSON.stringify(SEED_IDS, null, 2));
}

async function seed(db: Db, withSampleBookings: boolean): Promise<void> {
  const now = DateTime.now().setZone(SEED_TIMEZONE);
  if (!now.isValid) {
    throw new Error(`Invalid timezone ${SEED_TIMEZONE}`);
  }

  await db.transaction(async (tx) => {
    await clearSeed(tx);
    await insertStores(tx, now);
    if (withSampleBookings) {
      await insertSampleBookings(tx, now);
    }
    const checks = await runChecks(tx);
    printChecks(checks);
    if (checks.some((check) => !check.pass)) {
      throw new IntegrityCheckError();
    }
  });

  await printSummary(db);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const withSampleBookings = args.includes("--with-sample-bookings");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to web/.env.local.");
    return 1;
  }

  let host: string;
  try {
    host = databaseHost(databaseUrl);
  } catch (error) {
    console.error(`DATABASE_URL could not be parsed (${errorText(error)}).`);
    return 1;
  }

  if (!isLocalHost(host) && !force) {
    console.error(
      `REFUSED DATABASE_URL host "${host}" is outside localhost and 127.0.0.1. Pass --force to seed anyway.`,
    );
    return 1;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  try {
    await seed(db, withSampleBookings);
    return 0;
  } catch (error) {
    if (!(error instanceof IntegrityCheckError)) {
      console.error(errorText(error));
    }
    return 1;
  } finally {
    await pool.end();
  }
}

void main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(errorText(error));
    process.exit(1);
  });
