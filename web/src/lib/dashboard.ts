import "server-only";
import { and, count, desc, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { availabilityRules, bookings, businesses, businessDocuments, resources, services } from "@/lib/db/schema";

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

export const incompleteStoreCount = async () => {
  const rows = await db
    .select({ value: count() })
    .from(businesses)
    .where(
      sql`not exists (select 1 from ${availabilityRules} r where r.business_id = ${businesses.id} and r.resource_id is null)
        or not exists (select 1 from ${resources} r where r.business_id = ${businesses.id} and r.is_active)
        or not exists (select 1 from ${services} s where s.business_id = ${businesses.id} and s.is_active)
        or not exists (select 1 from ${businessDocuments} d where d.business_id = ${businesses.id} and d.type = 'privacy')
        or not exists (select 1 from ${businessDocuments} d where d.business_id = ${businesses.id} and d.type = 'terms')
        or not exists (select 1 from ${businessDocuments} d where d.business_id = ${businesses.id} and d.type = 'cancellation')`,
    );
  return Number(rows[0]?.value ?? 0);
};

export const recentBookings = async () =>
  db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      storeName: businesses.name,
      serviceName: services.name,
    })
    .from(bookings)
    .innerJoin(businesses, sql`${businesses.id} = ${bookings.businessId}`)
    .innerJoin(services, sql`${services.id} = ${bookings.serviceId}`)
    .orderBy(desc(bookings.createdAt))
    .limit(10);
