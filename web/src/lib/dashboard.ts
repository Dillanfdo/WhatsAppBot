import "server-only";
import { and, count, desc, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { availabilityRules, bookings, businesses, businessDocuments, resources, services } from "@/lib/db/schema";
import { firstSetupStep, readinessFromFacts, type SetupItem } from "@/lib/store-readiness";
import { formatLocalDateTime } from "@/lib/time";

export const storeStatusCounts = async () => {
  const rows = await db
    .select({
      live: sql<number>`count(*) filter (where ${businesses.isActive})::int`,
      draft: sql<number>`count(*) filter (where not ${businesses.isActive})::int`,
    })
    .from(businesses);
  return rows[0] ?? { live: 0, draft: 0 };
};

export const bookingsTodayCount = async () => {
  const rows = await db
    .select({ value: count() })
    .from(bookings)
    .innerJoin(businesses, sql`${businesses.id} = ${bookings.businessId}`)
    .where(
      sql`(${bookings.startsAt} at time zone ${businesses.timezone})::date = (now() at time zone ${businesses.timezone})::date`,
    );
  return Number(rows[0]?.value ?? 0);
};

export const upcomingWeekCount = async () => {
  const rows = await db
    .select({ value: count() })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["held", "confirmed"]),
        gte(bookings.startsAt, sql`now()`),
        lt(bookings.startsAt, sql`now() + interval '7 days'`),
      ),
    );
  return Number(rows[0]?.value ?? 0);
};

export const bookingTotal = async () => {
  const rows = await db.select({ value: count() }).from(bookings);
  return Number(rows[0]?.value ?? 0);
};

export type StoreSetupNeed = {
  id: string;
  name: string;
  isActive: boolean;
  missing: SetupItem[];
  resumeStep: number;
};

type SetupFactsRow = {
  id: string;
  name: string;
  is_active: boolean;
  hour_count: number;
  resource_count: number;
  service_count: number;
  doc_types: string[];
};

/** Stores that cannot go live yet, with what is missing, from one query. */
export const storesNeedingSetup = async (): Promise<StoreSetupNeed[]> => {
  const result = await db.execute<SetupFactsRow>(sql`
    select b.id, b.name, b.is_active,
      (select count(*)::int from ${availabilityRules} r where r.business_id = b.id and r.resource_id is null) as hour_count,
      (select count(*)::int from ${resources} r where r.business_id = b.id and r.is_active) as resource_count,
      (select count(*)::int from ${services} s where s.business_id = b.id and s.is_active) as service_count,
      array(select distinct d.type from ${businessDocuments} d where d.business_id = b.id) as doc_types
    from ${businesses} b
    order by b.created_at desc
  `);
  return result.rows.flatMap((row) => {
    const { missing } = readinessFromFacts({
      businessHourCount: row.hour_count,
      activeResourceCount: row.resource_count,
      activeServiceCount: row.service_count,
      documentTypes: row.doc_types,
    });
    return missing.length === 0
      ? []
      : [{ id: row.id, name: row.name, isActive: row.is_active, missing, resumeStep: firstSetupStep(missing) }];
  });
};

export const recentBookings = async () => {
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      storeName: businesses.name,
      timezone: businesses.timezone,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(businesses, sql`${businesses.id} = ${bookings.businessId}`)
    .innerJoin(services, sql`${services.id} = ${bookings.serviceId}`)
    .orderBy(desc(bookings.createdAt))
    .limit(10);
  return rows.map(({ startsAt, timezone, ...row }) => ({
    ...row,
    startsLabel: formatLocalDateTime(startsAt, timezone),
  }));
};
