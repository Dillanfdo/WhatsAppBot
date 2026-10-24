import "server-only";
import { and, asc, count, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import {
  bookingResources,
  bookings,
  businesses,
  customers,
  resources,
  services,
} from "@/lib/db/schema";
import { assignmentCombinations, freeByTypeAt } from "@/lib/booking/availability";
import {
  assertPartySize,
  assertStoreActive,
  dateGate,
  formatLocalLabel,
  formatPrice,
  hasAnyWindow,
  loadDayContext,
  loadService,
  loadStore,
  type DayContext,
} from "@/lib/booking/context";
import { BookingError, postgresErrorCode } from "@/lib/booking/errors";
import { judgeStart } from "@/lib/booking/slots";
import { toE164 } from "@/lib/phone";
import { toISO } from "@/lib/time";

export type BookingStatus = "held" | "confirmed" | "cancelled" | "completed" | "no_show";

export type BookingRecord = {
  id: string;
  storeId: string;
  status: BookingStatus;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  localLabel: string;
  partySize: number;
  price: string;
  resourceNames: string[];
  customerPhone: string;
  customerName: string | null;
};

export type CreateBookingInput = {
  storeId: string;
  serviceId: string;
  customerPhone: string;
  customerName?: string;
  startsAt: string;
  partySize: number;
  answers?: Record<string, unknown>;
  preferredResourceId?: string;
  idempotencyKey?: string;
  /** Trial default allows inactive stores so draft chat can book. */
  requireActive?: boolean;
};

export type CancelBookingInput = {
  storeId: string;
  bookingId: string;
  customerPhone?: string;
  byAdmin?: boolean;
};

export type ListBookingsInput = {
  storeId?: string;
  customerPhone?: string;
  status?: BookingStatus;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

const inStoreZone = (value: string, timezone: string): DateTime => {
  const hasZone = /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
  const parsed = hasZone
    ? DateTime.fromISO(value, { setZone: true }).setZone(timezone)
    : DateTime.fromISO(value, { zone: timezone });
  return parsed;
};

const requireIso = (value: string | null, label: string): string => {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  return value;
};

const rangeSql = (startIso: string, endIso: string) =>
  sql`tstzrange(${startIso}::timestamptz, ${endIso}::timestamptz, '[)')`;

type BookingRow = {
  id: string;
  storeId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  partySize: number;
  serviceName: string;
  priceCents: number | null;
  currency: string;
  customerPhone: string;
  customerName: string | null;
  timezone: string;
};

const toRecord = (row: BookingRow, resourceNames: string[]): BookingRecord => {
  const starts = DateTime.fromJSDate(row.startsAt).setZone(row.timezone);
  const ends = DateTime.fromJSDate(row.endsAt).setZone(row.timezone);
  return {
    id: row.id,
    storeId: row.storeId,
    status: row.status as BookingStatus,
    serviceName: row.serviceName,
    startsAt: toISO(starts),
    endsAt: toISO(ends),
    localLabel: formatLocalLabel(starts),
    partySize: row.partySize,
    price: formatPrice(row.priceCents, row.currency),
    resourceNames,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
  };
};

const loadRecord = async (storeId: string, bookingId: string): Promise<BookingRecord> => {
  const rows = await db
    .select({
      id: bookings.id,
      storeId: bookings.businessId,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      partySize: bookings.partySize,
      serviceName: services.name,
      priceCents: services.priceCents,
      currency: services.currency,
      customerPhone: customers.phone,
      customerName: customers.name,
      timezone: sql<string>`(select timezone from businesses where id = ${bookings.businessId})`,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, storeId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new BookingError("not_found", "Booking not found.");
  }
  const names = await db
    .select({ name: resources.name })
    .from(bookingResources)
    .innerJoin(resources, eq(resources.id, bookingResources.resourceId))
    .where(eq(bookingResources.bookingId, bookingId))
    .orderBy(asc(resources.name));
  return toRecord(row, names.map((item) => item.name));
};

const upsertCustomer = async (
  storeId: string,
  phone: string,
  name: string | undefined,
): Promise<{ id: string; phone: string; name: string | null }> => {
  const inserted = await db
    .insert(customers)
    .values({
      businessId: storeId,
      phone,
      name: name ?? null,
    })
    .onConflictDoUpdate({
      target: [customers.businessId, customers.phone],
      set: name ? { name } : { name: sql`${customers.name}` },
    })
    .returning({ id: customers.id, phone: customers.phone, name: customers.name });
  const customer = inserted[0];
  if (!customer) {
    throw new Error("Customer upsert did not return a row");
  }
  return customer;
};

const findExisting = async (input: {
  storeId: string;
  customerId: string;
  serviceId: string;
  startsAt: Date;
  idempotencyKey?: string;
}): Promise<string | null> => {
  if (input.idempotencyKey) {
    const byKey = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(eq(bookings.businessId, input.storeId), eq(bookings.idempotencyKey, input.idempotencyKey)),
      )
      .limit(1);
    if (byKey[0]) {
      return byKey[0].id;
    }
  }
  const duplicate = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.businessId, input.storeId),
        eq(bookings.customerId, input.customerId),
        eq(bookings.serviceId, input.serviceId),
        eq(bookings.startsAt, input.startsAt),
        inArray(bookings.status, ["held", "confirmed"]),
      ),
    )
    .limit(1);
  return duplicate[0]?.id ?? null;
};

const combinationsFor = (context: DayContext, start: DateTime) => {
  const startMin = start.hour * 60 + start.minute;
  const blockEnd = start.plus({
    minutes: context.service.durationMin + context.service.bufferAfterMin,
  });
  const free = freeByTypeAt(
    context.resources,
    context.busy,
    context.windows,
    startMin,
    context.service.durationMin,
    start.toMillis(),
    blockEnd.toMillis(),
  );
  return assignmentCombinations(free, context.requirements, 10);
};

export async function createBooking(input: CreateBookingInput): Promise<BookingRecord> {
  const phone = toE164(input.customerPhone);
  const store = await loadStore(input.storeId);
  if (input.requireActive) {
    assertStoreActive(store);
  }
  const service = await loadService(input.storeId, input.serviceId);
  assertPartySize(service, input.partySize);
  const start = inStoreZone(input.startsAt, store.timezone);
  if (!start.isValid) {
    throw new BookingError("invalid_state", "Use a start time in ISO format.");
  }

  const customer = await upsertCustomer(store.id, phone, input.customerName);
  const existingId = await findExisting({
    storeId: store.id,
    customerId: customer.id,
    serviceId: service.id,
    startsAt: start.toJSDate(),
    idempotencyKey: input.idempotencyKey,
  });
  if (existingId) {
    return loadRecord(store.id, existingId);
  }

  const date = start.toFormat("yyyy-MM-dd");
  const context = await loadDayContext({
    store,
    service,
    date,
    partySize: input.partySize,
    preferredResourceId: input.preferredResourceId,
  });
  const gate = dateGate(store, context.day, context.weekday);
  if (gate) {
    throw new BookingError(gate.code, gate.message);
  }
  if (input.preferredResourceId && context.resources.length === 0) {
    throw new BookingError("slot_unavailable", "That resource cannot take this booking.");
  }
  if (!hasAnyWindow(context.windows)) {
    throw new BookingError("closed_that_day", "The store is closed that day.");
  }
  const verdict = judgeStart(context, start);
  if (!verdict.ok) {
    throw new BookingError(verdict.code, verdict.message);
  }

  const cap = store.config.max_active_bookings_per_customer ?? 0;
  if (cap > 0) {
    const active = await db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.customerId, customer.id),
          inArray(bookings.status, ["held", "confirmed"]),
          gt(bookings.endsAt, new Date()),
        ),
      );
    if (Number(active[0]?.value ?? 0) >= cap) {
      throw new BookingError(
        "max_bookings_reached",
        `You already have ${cap} active bookings. Cancel one before booking another.`,
      );
    }
  }

  const combos = combinationsFor(context, start);
  if (combos.length === 0) {
    throw new BookingError("slot_taken", "That time is already booked.");
  }

  const endsAt = start.plus({ minutes: service.durationMin });
  const blockEnd = endsAt.plus({ minutes: service.bufferAfterMin });
  const startIso = requireIso(start.toISO(), "start");
  const blockIso = requireIso(blockEnd.toISO(), "block end");
  const status = store.config.auto_confirm !== false ? "confirmed" : "held";

  for (const combo of combos) {
    try {
      const createdId = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bookings)
          .values({
            businessId: store.id,
            customerId: customer.id,
            serviceId: service.id,
            startsAt: start.toJSDate(),
            endsAt: endsAt.toJSDate(),
            partySize: input.partySize,
            status,
            answers: input.answers,
            idempotencyKey: input.idempotencyKey,
          })
          .returning({ id: bookings.id });
        const booking = inserted[0];
        if (!booking) {
          throw new Error("Booking insert did not return an id");
        }
        await tx.insert(bookingResources).values(
          combo.map((resource) => ({
            bookingId: booking.id,
            resourceId: resource.id,
            during: rangeSql(startIso, blockIso),
            active: true,
          })),
        );
        return booking.id;
      });
      return loadRecord(store.id, createdId);
    } catch (error) {
      const code = postgresErrorCode(error);
      if (code === "23P01") {
        continue;
      }
      if (code === "23505" && input.idempotencyKey) {
        const raced = await findExisting({
          storeId: store.id,
          customerId: customer.id,
          serviceId: service.id,
          startsAt: start.toJSDate(),
          idempotencyKey: input.idempotencyKey,
        });
        if (raced) {
          return loadRecord(store.id, raced);
        }
      }
      throw error;
    }
  }

  throw new BookingError("slot_taken", "That time was just taken.");
}

const loadOwned = async (storeId: string, bookingId: string) => {
  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      startsAt: bookings.startsAt,
      customerPhone: customers.phone,
      timezone: sql<string>`(select timezone from businesses b where b.id = ${bookings.businessId})`,
      cancellationWindow: sql<number | null>`(
        select (config->>'cancellation_window_hours')::numeric
        from businesses b where b.id = ${bookings.businessId}
      )`,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(and(eq(bookings.id, bookingId), eq(bookings.businessId, storeId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new BookingError("not_found", "Booking not found.");
  }
  return row;
};

const assertCustomerWindow = (
  row: { startsAt: Date; customerPhone: string; timezone: string; cancellationWindow: number | null },
  customerPhone: string | undefined,
  byAdmin: boolean | undefined,
) => {
  if (byAdmin) {
    return;
  }
  const phone = toE164(customerPhone ?? "");
  if (phone !== row.customerPhone) {
    throw new BookingError("not_owner", "That booking belongs to someone else.");
  }
  const windowHours = Number(row.cancellationWindow ?? 0);
  const start = DateTime.fromJSDate(row.startsAt).setZone(row.timezone);
  const latest = start.minus({ hours: windowHours });
  if (DateTime.now().setZone(row.timezone) > latest) {
    throw new BookingError(
      "cancellation_window_passed",
      windowHours > 0
        ? `Cancellations need at least ${windowHours} hours' notice.`
        : "This booking can no longer be changed.",
    );
  }
};

export async function cancelBooking(input: CancelBookingInput): Promise<BookingRecord> {
  const row = await loadOwned(input.storeId, input.bookingId);
  if (row.status !== "held" && row.status !== "confirmed") {
    throw new BookingError("invalid_state", "That booking is not active.");
  }
  assertCustomerWindow(row, input.customerPhone, input.byAdmin);
  await db.transaction(async (tx) => {
    await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(bookings.id, input.bookingId));
    await tx
      .update(bookingResources)
      .set({ active: false })
      .where(eq(bookingResources.bookingId, input.bookingId));
  });
  return loadRecord(input.storeId, input.bookingId);
}

export async function confirmHeldBooking(storeId: string, bookingId: string): Promise<BookingRecord> {
  const row = await loadOwned(storeId, bookingId);
  if (row.status !== "held") {
    throw new BookingError("invalid_state", "Only a held booking can be confirmed.");
  }
  await db
    .update(bookings)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
  return loadRecord(storeId, bookingId);
}

export async function rescheduleBooking(input: {
  storeId: string;
  bookingId: string;
  customerPhone: string;
  newStartsAt: string;
}): Promise<BookingRecord> {
  const row = await loadOwned(input.storeId, input.bookingId);
  if (row.status !== "held" && row.status !== "confirmed") {
    throw new BookingError("invalid_state", "That booking is not active.");
  }
  assertCustomerWindow(row, input.customerPhone, false);

  const current = await db
    .select({
      serviceId: bookings.serviceId,
      partySize: bookings.partySize,
      customerId: bookings.customerId,
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .where(eq(bookings.id, input.bookingId))
    .limit(1);
  const booking = current[0];
  if (!booking) {
    throw new BookingError("not_found", "Booking not found.");
  }

  const store = await loadStore(input.storeId);
  const service = await loadService(input.storeId, booking.serviceId);
  const start = inStoreZone(input.newStartsAt, store.timezone);
  if (!start.isValid) {
    throw new BookingError("invalid_state", "Use a start time in ISO format.");
  }
  const withoutSelf = await loadDayContext({
    store,
    service,
    date: start.toFormat("yyyy-MM-dd"),
    partySize: booking.partySize,
    excludeBookingId: input.bookingId,
  });
  const gate = dateGate(store, withoutSelf.day, withoutSelf.weekday);
  if (gate) {
    throw new BookingError(gate.code, gate.message);
  }
  if (!hasAnyWindow(withoutSelf.windows)) {
    throw new BookingError("closed_that_day", "The store is closed that day.");
  }
  const verdict = judgeStart(withoutSelf, start);
  if (!verdict.ok) {
    throw new BookingError(verdict.code, verdict.message);
  }
  const combos = combinationsFor(withoutSelf, start);
  if (combos.length === 0) {
    throw new BookingError("slot_taken", "That time is already booked.");
  }
  const combo = combos[0];
  if (!combo) {
    throw new BookingError("slot_taken", "That time is already booked.");
  }

  const endsAt = start.plus({ minutes: service.durationMin });
  const blockEnd = endsAt.plus({ minutes: service.bufferAfterMin });
  const startIso = requireIso(start.toISO(), "start");
  const blockIso = requireIso(blockEnd.toISO(), "block end");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(bookingResources)
        .set({ active: false })
        .where(eq(bookingResources.bookingId, input.bookingId));
      for (const resource of combo) {
        await tx
          .insert(bookingResources)
          .values({
            bookingId: input.bookingId,
            resourceId: resource.id,
            during: rangeSql(startIso, blockIso),
            active: true,
          })
          .onConflictDoUpdate({
            target: [bookingResources.bookingId, bookingResources.resourceId],
            set: { during: rangeSql(startIso, blockIso), active: true },
          });
      }
      await tx
        .update(bookings)
        .set({ startsAt: start.toJSDate(), endsAt: endsAt.toJSDate(), updatedAt: new Date() })
        .where(eq(bookings.id, input.bookingId));
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23P01") {
      throw new BookingError("slot_taken", "That time was just taken.");
    }
    throw error;
  }
  return loadRecord(input.storeId, input.bookingId);
}

export async function getBooking(bookingId: string): Promise<BookingRecord> {
  const rows = await db
    .select({ storeId: bookings.businessId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new BookingError("not_found", "Booking not found.");
  }
  return loadRecord(row.storeId, bookingId);
}

export async function listBookings(
  input: ListBookingsInput,
): Promise<{ bookings: BookingRecord[]; total: number }> {
  const zone = input.storeId ? (await loadStore(input.storeId)).timezone : "Asia/Kolkata";
  const filters = [];
  if (input.storeId) {
    filters.push(eq(bookings.businessId, input.storeId));
  }
  if (input.customerPhone) {
    filters.push(eq(customers.phone, toE164(input.customerPhone)));
  }
  if (input.status) {
    filters.push(eq(bookings.status, input.status));
  }
  if (input.from) {
    const from = DateTime.fromISO(input.from, { zone });
    if (!from.isValid) {
      throw new BookingError("invalid_state", "Use a from date like 2026-10-23.");
    }
    filters.push(gte(bookings.startsAt, from.startOf("day").toJSDate()));
  }
  if (input.to) {
    const to = DateTime.fromISO(input.to, { zone });
    if (!to.isValid) {
      throw new BookingError("invalid_state", "Use a to date like 2026-10-23.");
    }
    filters.push(lte(bookings.startsAt, to.endOf("day").toJSDate()));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const totalRows = await db
    .select({ value: count() })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .where(where);
  const rows = await db
    .select({
      id: bookings.id,
      storeId: bookings.businessId,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      partySize: bookings.partySize,
      serviceName: services.name,
      priceCents: services.priceCents,
      currency: services.currency,
      customerPhone: customers.phone,
      customerName: customers.name,
      timezone: businesses.timezone,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(where)
    .orderBy(asc(bookings.startsAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((row) => row.id);
  const nameRows =
    ids.length === 0
      ? []
      : await db
          .select({ bookingId: bookingResources.bookingId, name: resources.name })
          .from(bookingResources)
          .innerJoin(resources, eq(resources.id, bookingResources.resourceId))
          .where(inArray(bookingResources.bookingId, ids))
          .orderBy(asc(resources.name));
  const namesByBooking = new Map<string, string[]>();
  for (const nameRow of nameRows) {
    const list = namesByBooking.get(nameRow.bookingId) ?? [];
    list.push(nameRow.name);
    namesByBooking.set(nameRow.bookingId, list);
  }

  return {
    total: Number(totalRows[0]?.value ?? 0),
    bookings: rows.map((row) => toRecord(row, namesByBooking.get(row.id) ?? [])),
  };
}
