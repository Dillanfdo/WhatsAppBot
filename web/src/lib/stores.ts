import "server-only";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  availabilityRules,
  businessDocuments,
  businesses,
  resources,
  services,
  type BusinessConfig,
} from "@/lib/db/schema";
import { readinessFromFacts, type StoreReadiness } from "@/lib/store-readiness";
import {
  STORE_HOURS_WEEKDAYS,
  storeDetailsSchema,
  storeResourceSchema,
  updateStoreHoursSchema,
  type CreateStoreInput,
  type StoreDetails,
  type StoreResource,
  type StoreSummary,
  type UpdateStoreHoursInput,
  type UpdateStoreInput,
} from "@/lib/validation";

export type { StoreDetails, StoreResource, StoreSummary, StoreReadiness, UpdateStoreHoursInput };

const DEFAULT_SLOT_INTERVAL_MIN = 15;

const configFromInput = (input: {
  tone: string;
  languages: string[];
  cancellationWindowHours: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  autoConfirm: boolean;
  maxActiveBookingsPerCustomer: number;
}): BusinessConfig => ({
  tone: input.tone,
  languages: input.languages,
  cancellation_window_hours: input.cancellationWindowHours,
  min_notice_hours: input.minNoticeHours,
  max_days_ahead: input.maxDaysAhead,
  auto_confirm: input.autoConfirm,
  max_active_bookings_per_customer: input.maxActiveBookingsPerCustomer,
});

const emptyToNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const storeColumns = {
  id: businesses.id,
  name: businesses.name,
  type: businesses.type,
  description: businesses.description,
  address: businesses.address,
  mapUrl: businesses.mapUrl,
  timezone: businesses.timezone,
  slotIntervalMin: businesses.slotIntervalMin,
  contactPhone: businesses.contactPhone,
  contactEmail: businesses.contactEmail,
  ownerWhatsapp: businesses.ownerWhatsapp,
  isActive: businesses.isActive,
  config: businesses.config,
  createdAt: businesses.createdAt,
  updatedAt: businesses.updatedAt,
};

const countResources = async (businessId: string): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(resources)
    .where(eq(resources.businessId, businessId));

  return Number(rows[0]?.value ?? 0);
};

export async function listStoreResources(businessId: string): Promise<StoreResource[]> {
  const rows = await db
    .select({
      id: resources.id,
      type: resources.type,
      name: resources.name,
      capacity: resources.capacity,
      isActive: resources.isActive,
    })
    .from(resources)
    .where(eq(resources.businessId, businessId))
    .orderBy(asc(resources.name));

  return z.array(storeResourceSchema).parse(rows);
}

export async function listStores(): Promise<StoreSummary[]> {
  return db
    .select({
      id: businesses.id,
      name: businesses.name,
      type: businesses.type,
      timezone: businesses.timezone,
      isActive: businesses.isActive,
    })
    .from(businesses)
    .orderBy(asc(businesses.name));
}

export async function createStore(input: CreateStoreInput): Promise<StoreDetails> {
  const inserted = await db
    .insert(businesses)
    .values({
      name: input.name,
      type: input.type,
      description: emptyToNull(input.description),
      address: emptyToNull(input.address),
      mapUrl: emptyToNull(input.mapUrl),
      timezone: input.timezone,
      slotIntervalMin: DEFAULT_SLOT_INTERVAL_MIN,
      contactPhone: emptyToNull(input.contactPhone),
      contactEmail: emptyToNull(input.contactEmail),
      ownerWhatsapp: emptyToNull(input.ownerWhatsapp),
      config: configFromInput(input),
      isActive: false,
    })
    .returning({ id: businesses.id });

  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Store insert did not return an id");
  }

  const store = await getStore(id);
  if (!store) {
    throw new Error("Store insert could not be read back");
  }

  return store;
}

export async function getStore(id: string): Promise<StoreDetails | null> {
  const rows = await db.select(storeColumns).from(businesses).where(eq(businesses.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }

  const resourceCount = await countResources(id);
  return storeDetailsSchema.parse({ ...row, resourceCount });
}

export const updateStore = async (
  id: string,
  input: UpdateStoreInput,
): Promise<StoreDetails | null> => {
  const existing = await db
    .select({ config: businesses.config })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return null;
  }

  const slotIntervalMin = input.slotUnit === "hours" ? input.slotAmount * 60 : input.slotAmount;
  const config: BusinessConfig = {
    ...current.config,
    ...configFromInput(input),
  };

  const updated = await db
    .update(businesses)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      description: emptyToNull(input.description),
      address: emptyToNull(input.address),
      mapUrl: emptyToNull(input.mapUrl),
      contactPhone: emptyToNull(input.contactPhone),
      contactEmail: emptyToNull(input.contactEmail),
      ownerWhatsapp: emptyToNull(input.ownerWhatsapp),
      slotIntervalMin,
      config,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, id))
    .returning({ id: businesses.id });

  if (updated.length === 0) {
    return null;
  }

  return getStore(id);
};

const toHHMM = (value: string): string => {
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value;
};

export async function listStoreHours(businessId: string): Promise<UpdateStoreHoursInput | null> {
  const stores = await db
    .select({ config: businesses.config })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  const store = stores[0];
  if (!store) {
    return null;
  }

  const rows = await db
    .select({
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
    })
    .from(availabilityRules)
    .where(and(eq(availabilityRules.businessId, businessId), isNull(availabilityRules.resourceId)))
    .orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime));

  const openWeekdays = new Set(rows.map((row) => row.weekday));
  const bookableWeekdays = new Set(store.config.bookable_weekdays ?? [...openWeekdays]);

  return updateStoreHoursSchema.parse({
    days: STORE_HOURS_WEEKDAYS.map(({ weekday }) => {
      const shifts = rows
        .filter((row) => row.weekday === weekday)
        .map((row) => ({ start: toHHMM(row.startTime), end: toHHMM(row.endTime) }));
      return {
        weekday,
        bookable: shifts.length > 0 && bookableWeekdays.has(weekday),
        shifts,
      };
    }),
  });
}

export const replaceStoreHours = async (
  id: string,
  input: UpdateStoreHoursInput,
): Promise<UpdateStoreHoursInput | null> => {
  const existing = await db
    .select({ config: businesses.config })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1);

  const current = existing[0];
  if (!current) {
    return null;
  }

  const bookableWeekdays = input.days
    .filter((day) => day.bookable)
    .map((day) => day.weekday)
    .sort((left, right) => left - right);

  const rows = input.days.flatMap((day) =>
    day.shifts.map((shift) => ({
      businessId: id,
      resourceId: null,
      weekday: day.weekday,
      startTime: `${shift.start}:00`,
      endTime: `${shift.end}:00`,
    })),
  );

  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityRules)
      .where(and(eq(availabilityRules.businessId, id), isNull(availabilityRules.resourceId)));

    if (rows.length > 0) {
      await tx.insert(availabilityRules).values(rows);
    }

    await tx
      .update(businesses)
      .set({
        config: {
          ...current.config,
          bookable_weekdays: bookableWeekdays,
        },
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, id));
  });

  return listStoreHours(id);
};

const storeExists = async (id: string): Promise<boolean> => {
  const rows = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1);
  return rows.length > 0;
};

const countRows = async (
  rows: Promise<{ value: number }[]>,
): Promise<number> => {
  const result = await rows;
  return Number(result[0]?.value ?? 0);
};

export async function getStoreReadiness(id: string): Promise<StoreReadiness | null> {
  if (!(await storeExists(id))) {
    return null;
  }

  const [businessHourCount, activeResourceCount, activeServiceCount, documentRows] =
    await Promise.all([
      countRows(
        db
          .select({ value: count() })
          .from(availabilityRules)
          .where(
            and(eq(availabilityRules.businessId, id), isNull(availabilityRules.resourceId)),
          ),
      ),
      countRows(
        db
          .select({ value: count() })
          .from(resources)
          .where(and(eq(resources.businessId, id), eq(resources.isActive, true))),
      ),
      countRows(
        db
          .select({ value: count() })
          .from(services)
          .where(and(eq(services.businessId, id), eq(services.isActive, true))),
      ),
      db
        .selectDistinct({ type: businessDocuments.type })
        .from(businessDocuments)
        .where(
          and(
            eq(businessDocuments.businessId, id),
            sql`btrim(${businessDocuments.content}) <> ''`,
          ),
        ),
    ]);

  return readinessFromFacts({
    businessHourCount,
    activeResourceCount,
    activeServiceCount,
    documentTypes: documentRows.map((row) => row.type),
  });
}

export type ActivateStoreResult =
  | { status: "not_found" }
  | { status: "not_ready"; missing: StoreReadiness["missing"] }
  | { status: "active"; store: StoreDetails };

export async function activateStore(id: string): Promise<ActivateStoreResult> {
  const readiness = await getStoreReadiness(id);
  if (!readiness) {
    return { status: "not_found" };
  }
  if (!readiness.ready) {
    return { status: "not_ready", missing: readiness.missing };
  }

  const current = await getStore(id);
  if (!current) {
    return { status: "not_found" };
  }
  if (current.isActive) {
    return { status: "active", store: current };
  }

  await db
    .update(businesses)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(businesses.id, id));

  const store = await getStore(id);
  if (!store) {
    return { status: "not_found" };
  }
  return { status: "active", store };
}

export async function deactivateStore(id: string): Promise<StoreDetails | null> {
  const current = await getStore(id);
  if (!current) {
    return null;
  }
  if (!current.isActive) {
    return current;
  }
  await db
    .update(businesses)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(businesses.id, id));
  return getStore(id);
}
