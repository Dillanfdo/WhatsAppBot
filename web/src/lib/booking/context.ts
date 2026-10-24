import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import {
  availabilityExceptions,
  availabilityRules,
  businesses,
  resources,
  serviceResourceRequirements,
  serviceResources,
  services,
  type BusinessConfig,
} from "@/lib/db/schema";
import {
  addWindows,
  minutesFromClock,
  subtractWindows,
  type MinuteWindow,
  type Requirement,
  type ResourceCandidate,
} from "@/lib/booking/availability";
import { BookingError } from "@/lib/booking/errors";
import { toDbWeekday } from "@/lib/time";

export type LoadedService = {
  id: string;
  businessId: string;
  name: string;
  durationMin: number;
  bufferAfterMin: number;
  priceCents: number | null;
  currency: string;
  minParty: number;
  maxParty: number;
  isActive: boolean;
};

export type LoadedStore = {
  id: string;
  name: string;
  timezone: string;
  slotIntervalMin: number;
  isActive: boolean;
  contactPhone: string | null;
  config: BusinessConfig;
};

export type BusyRange = {
  resourceId: string;
  startMs: number;
  endMs: number;
};

export type DayContext = {
  store: LoadedStore;
  service: LoadedService;
  requirements: Requirement[];
  resources: ResourceCandidate[];
  windows: Map<string, MinuteWindow[]>;
  busy: BusyRange[];
  day: DateTime;
  weekday: number;
};

const requireIso = (value: string | null, label: string): string => {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  return value;
};

export const formatPrice = (cents: number | null, currency = "INR"): string => {
  if (cents === null) {
    return "no charge";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

export const formatLocalLabel = (value: DateTime): string => value.toFormat("ccc d LLL, h:mm a");

export const loadStore = async (storeId: string): Promise<LoadedStore> => {
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      timezone: businesses.timezone,
      slotIntervalMin: businesses.slotIntervalMin,
      isActive: businesses.isActive,
      contactPhone: businesses.contactPhone,
      config: businesses.config,
    })
    .from(businesses)
    .where(eq(businesses.id, storeId))
    .limit(1);
  const store = rows[0];
  if (!store) {
    throw new BookingError("not_found", "Store not found.");
  }
  return store;
};

export const loadService = async (storeId: string, serviceId: string): Promise<LoadedService> => {
  const rows = await db
    .select({
      id: services.id,
      businessId: services.businessId,
      name: services.name,
      durationMin: services.durationMin,
      bufferAfterMin: services.bufferAfterMin,
      priceCents: services.priceCents,
      currency: services.currency,
      minParty: services.minParty,
      maxParty: services.maxParty,
      isActive: services.isActive,
    })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.businessId, storeId)))
    .limit(1);
  const service = rows[0];
  if (!service) {
    throw new BookingError("not_found", "Service not found.");
  }
  if (!service.isActive) {
    throw new BookingError("service_inactive", `${service.name} is not available.`);
  }
  return service;
};

export const assertPartySize = (service: LoadedService, partySize: number): void => {
  if (!Number.isInteger(partySize) || partySize < service.minParty || partySize > service.maxParty) {
    throw new BookingError(
      "invalid_party_size",
      `${service.name} accepts ${service.minParty} to ${service.maxParty} people.`,
    );
  }
};

export const assertStoreActive = (store: LoadedStore): void => {
  if (!store.isActive) {
    throw new BookingError("store_inactive", `${store.name} is not accepting bookings.`);
  }
};

const clipException = (
  startsAt: Date,
  endsAt: Date,
  day: DateTime,
): MinuteWindow | null => {
  const dayStart = day.startOf("day");
  const dayEnd = dayStart.plus({ days: 1 });
  const start = DateTime.fromJSDate(startsAt).setZone(day.zone);
  const end = DateTime.fromJSDate(endsAt).setZone(day.zone);
  const clippedStart = start > dayStart ? start : dayStart;
  const clippedEnd = end < dayEnd ? end : dayEnd;
  if (clippedEnd <= clippedStart) {
    return null;
  }
  return {
    startMin: Math.round(clippedStart.diff(dayStart, "minutes").minutes),
    endMin: Math.round(clippedEnd.diff(dayStart, "minutes").minutes),
  };
};

const windowsForResource = (
  resourceId: string,
  weekday: number,
  rules: { resourceId: string | null; weekday: number; startTime: string; endTime: string }[],
  exceptions: { resourceId: string | null; startsAt: Date; endsAt: Date; isOpen: boolean }[],
  day: DateTime,
): MinuteWindow[] => {
  const ownRules = rules.filter((rule) => rule.resourceId === resourceId);
  const source = ownRules.length > 0 ? ownRules : rules.filter((rule) => rule.resourceId === null);
  let windows: MinuteWindow[] = source
    .filter((rule) => rule.weekday === weekday)
    .map((rule) => ({
      startMin: minutesFromClock(rule.startTime),
      endMin: minutesFromClock(rule.endTime),
    }));

  const closed: MinuteWindow[] = [];
  const opened: MinuteWindow[] = [];
  for (const exception of exceptions) {
    if (exception.resourceId !== null && exception.resourceId !== resourceId) {
      continue;
    }
    const window = clipException(exception.startsAt, exception.endsAt, day);
    if (!window) {
      continue;
    }
    if (exception.isOpen) {
      opened.push(window);
    } else {
      closed.push(window);
    }
  }
  windows = subtractWindows(windows, closed);
  return addWindows(windows, opened);
};

export const loadDayContext = async (input: {
  store: LoadedStore;
  service: LoadedService;
  date: string;
  partySize: number;
  preferredResourceId?: string;
  excludeBookingId?: string;
}): Promise<DayContext> => {
  const day = DateTime.fromISO(input.date, { zone: input.store.timezone });
  if (!day.isValid) {
    throw new BookingError("invalid_state", "Use a date like 2026-10-23.");
  }
  const weekday = toDbWeekday(day);

  const [requirementRows, restrictionRows, resourceRows, ruleRows, exceptionRows] = await Promise.all([
    db
      .select({
        resourceType: serviceResourceRequirements.resourceType,
        quantity: serviceResourceRequirements.quantity,
      })
      .from(serviceResourceRequirements)
      .where(eq(serviceResourceRequirements.serviceId, input.service.id)),
    db
      .select({ resourceId: serviceResources.resourceId })
      .from(serviceResources)
      .where(eq(serviceResources.serviceId, input.service.id)),
    db
      .select({
        id: resources.id,
        type: resources.type,
        name: resources.name,
        capacity: resources.capacity,
      })
      .from(resources)
      .where(and(eq(resources.businessId, input.store.id), eq(resources.isActive, true))),
    db
      .select({
        resourceId: availabilityRules.resourceId,
        weekday: availabilityRules.weekday,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
      })
      .from(availabilityRules)
      .where(eq(availabilityRules.businessId, input.store.id)),
    db
      .select({
        resourceId: availabilityExceptions.resourceId,
        startsAt: availabilityExceptions.startsAt,
        endsAt: availabilityExceptions.endsAt,
        isOpen: availabilityExceptions.isOpen,
      })
      .from(availabilityExceptions)
      .where(eq(availabilityExceptions.businessId, input.store.id)),
  ]);

  if (requirementRows.length === 0) {
    throw new BookingError("slot_unavailable", `${input.service.name} has no bookable resources.`);
  }

  const restrictedIds = new Set(restrictionRows.map((row) => row.resourceId));
  const typesWithRestrictions = new Set(
    resourceRows.filter((row) => restrictedIds.has(row.id)).map((row) => row.type),
  );

  let eligible = resourceRows.filter((resource) => {
    const needed = requirementRows.some((requirement) => requirement.resourceType === resource.type);
    if (!needed || resource.capacity < input.partySize) {
      return false;
    }
    if (typesWithRestrictions.has(resource.type) && !restrictedIds.has(resource.id)) {
      return false;
    }
    return true;
  });

  if (input.preferredResourceId) {
    const preferred = eligible.find((resource) => resource.id === input.preferredResourceId);
    eligible = preferred
      ? eligible.filter((resource) => resource.type !== preferred.type || resource.id === preferred.id)
      : [];
  }

  const windows = new Map<string, MinuteWindow[]>();
  for (const resource of eligible) {
    windows.set(resource.id, windowsForResource(resource.id, weekday, ruleRows, exceptionRows, day));
  }

  const busy = await loadBusy(
    eligible.map((resource) => resource.id),
    day,
    input.service.durationMin + input.service.bufferAfterMin,
    input.excludeBookingId,
  );

  return {
    store: input.store,
    service: input.service,
    requirements: requirementRows,
    resources: eligible,
    windows,
    busy,
    day,
    weekday,
  };
};

const loadBusy = async (
  resourceIds: string[],
  day: DateTime,
  spanMin: number,
  excludeBookingId?: string,
): Promise<BusyRange[]> => {
  if (resourceIds.length === 0) {
    return [];
  }
  const rangeStart = requireIso(day.startOf("day").minus({ minutes: spanMin }).toISO(), "range start");
  const rangeEnd = requireIso(day.startOf("day").plus({ days: 1, minutes: spanMin }).toISO(), "range end");
  const excluded = excludeBookingId ? sql`AND br.booking_id <> ${excludeBookingId}::uuid` : sql``;
  const result = await db.execute<{ resource_id: string; start_at: Date | string; end_at: Date | string }>(sql`
    SELECT br.resource_id, lower(br.during) AS start_at, upper(br.during) AS end_at
    FROM booking_resources br
    WHERE br.active = true
      AND br.resource_id IN (${sql.join(
        resourceIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      AND br.during && tstzrange(${rangeStart}::timestamptz, ${rangeEnd}::timestamptz, '[)')
      ${excluded}
  `);
  const rows = "rows" in result ? result.rows : result;
  return [...rows].map((row) => ({
    resourceId: row.resource_id,
    startMs: new Date(row.start_at).getTime(),
    endMs: new Date(row.end_at).getTime(),
  }));
};

export const dateGate = (
  store: LoadedStore,
  day: DateTime,
  weekday: number,
): { code: "too_soon" | "too_far" | "closed_that_day"; message: string } | null => {
  const today = DateTime.now().setZone(store.timezone).startOf("day");
  const target = day.startOf("day");
  if (target < today) {
    return { code: "too_soon", message: "That date has already passed." };
  }
  const maxDays = store.config.max_days_ahead;
  if (maxDays !== undefined && target > today.plus({ days: maxDays })) {
    return {
      code: "too_far",
      message: `Bookings are open up to ${maxDays} days ahead.`,
    };
  }
  const bookable = store.config.bookable_weekdays;
  if (bookable && !bookable.includes(weekday)) {
    return { code: "closed_that_day", message: "The store does not take bookings on that day." };
  }
  return null;
};

export const hasAnyWindow = (windows: ReadonlyMap<string, MinuteWindow[]>): boolean =>
  [...windows.values()].some((list) => list.length > 0);
