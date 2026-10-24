import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import {
  availabilityExceptions,
  availabilityRules,
  bookingResources,
  businessDocuments,
  businesses,
  resources,
  serviceResourceRequirements,
  serviceResources,
  services,
  type IntakeQuestion,
} from "@/lib/db/schema";
import { BookingError } from "@/lib/booking/errors";

const assertStore = async (storeId: string) => {
  const rows = await db
    .select({ id: businesses.id, timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, storeId))
    .limit(1);
  const store = rows[0];
  if (!store) {
    throw new BookingError("not_found", "Store not found.");
  }
  return store;
};

export const listResources = async (storeId: string) => {
  await assertStore(storeId);
  return db
    .select({
      id: resources.id,
      type: resources.type,
      name: resources.name,
      capacity: resources.capacity,
      isActive: resources.isActive,
    })
    .from(resources)
    .where(eq(resources.businessId, storeId))
    .orderBy(asc(resources.name));
};

export const createResource = async (input: {
  storeId: string;
  type: string;
  name: string;
  capacity: number;
  isActive?: boolean;
}) => {
  await assertStore(input.storeId);
  const inserted = await db
    .insert(resources)
    .values({
      businessId: input.storeId,
      type: input.type,
      name: input.name,
      capacity: input.capacity,
      isActive: input.isActive ?? true,
    })
    .returning({ id: resources.id });
  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Resource insert failed");
  }
  return (await listResources(input.storeId)).find((row) => row.id === id);
};

export const updateResource = async (
  storeId: string,
  resourceId: string,
  patch: { type?: string; name?: string; capacity?: number; isActive?: boolean },
) => {
  await assertStore(storeId);
  const updated = await db
    .update(resources)
    .set(patch)
    .where(and(eq(resources.id, resourceId), eq(resources.businessId, storeId)))
    .returning({ id: resources.id });
  if (updated.length === 0) {
    throw new BookingError("not_found", "Resource not found.");
  }
  return (await listResources(storeId)).find((row) => row.id === resourceId);
};

export const deleteResource = async (storeId: string, resourceId: string) => {
  await assertStore(storeId);
  const owned = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.id, resourceId), eq(resources.businessId, storeId)))
    .limit(1);
  if (!owned[0]) {
    throw new BookingError("not_found", "Resource not found.");
  }
  const used = await db
    .select({ value: count() })
    .from(bookingResources)
    .where(eq(bookingResources.resourceId, resourceId));
  if (Number(used[0]?.value ?? 0) > 0) {
    await db.update(resources).set({ isActive: false }).where(eq(resources.id, resourceId));
    return { deactivated: true };
  }
  await db.delete(availabilityExceptions).where(eq(availabilityExceptions.resourceId, resourceId));
  await db.delete(serviceResources).where(eq(serviceResources.resourceId, resourceId));
  await db.delete(availabilityRules).where(eq(availabilityRules.resourceId, resourceId));
  await db.delete(resources).where(eq(resources.id, resourceId));
  return { deactivated: false };
};

export type ServiceView = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  bufferAfterMin: number;
  priceCents: number | null;
  currency: string;
  minParty: number;
  maxParty: number;
  intakeQuestions: IntakeQuestion[];
  isActive: boolean;
  requirements: { resourceType: string; quantity: number }[];
  resourceIds: string[];
};

export const listServices = async (storeId: string): Promise<ServiceView[]> => {
  await assertStore(storeId);
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.businessId, storeId))
    .orderBy(asc(services.name));
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const [requirements, links] = await Promise.all([
    db
      .select()
      .from(serviceResourceRequirements)
      .where(inArray(serviceResourceRequirements.serviceId, ids)),
    db.select().from(serviceResources).where(inArray(serviceResources.serviceId, ids)),
  ]);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.durationMin,
    bufferAfterMin: row.bufferAfterMin,
    priceCents: row.priceCents,
    currency: row.currency,
    minParty: row.minParty,
    maxParty: row.maxParty,
    intakeQuestions: row.intakeQuestions,
    isActive: row.isActive,
    requirements: requirements
      .filter((item) => item.serviceId === row.id)
      .map((item) => ({ resourceType: item.resourceType, quantity: item.quantity })),
    resourceIds: links.filter((item) => item.serviceId === row.id).map((item) => item.resourceId),
  }));
};

export const listServiceOptions = async (storeId: string) =>
  (await listServices(storeId)).map((service) => ({
    id: service.id,
    name: service.name,
    durationMin: service.durationMin,
    isActive: service.isActive,
  }));

type ServiceWrite = {
  name: string;
  description?: string;
  durationMin: number;
  bufferAfterMin?: number;
  priceCents?: number | null;
  minParty?: number;
  maxParty?: number;
  intakeQuestions?: IntakeQuestion[];
  isActive?: boolean;
  requirements?: { resourceType: string; quantity: number }[];
  resourceIds?: string[];
};

const saveLinks = async (
  storeId: string,
  serviceId: string,
  requirements: { resourceType: string; quantity: number }[] | undefined,
  resourceIds: string[] | undefined,
) => {
  if (requirements) {
    await db.delete(serviceResourceRequirements).where(eq(serviceResourceRequirements.serviceId, serviceId));
    if (requirements.length > 0) {
      await db.insert(serviceResourceRequirements).values(
        requirements.map((requirement) => ({
          serviceId,
          resourceType: requirement.resourceType,
          quantity: requirement.quantity,
        })),
      );
    }
  }
  if (resourceIds) {
    const allowed = await db
      .select({ id: resources.id, type: resources.type })
      .from(resources)
      .where(eq(resources.businessId, storeId));
    const byId = new Map(allowed.map((row) => [row.id, row.type]));
    const requiredTypes = new Set((requirements ?? []).map((item) => item.resourceType));
    for (const resourceId of resourceIds) {
      const type = byId.get(resourceId);
      if (!type) {
        throw new BookingError("invalid_state", "A selected resource does not belong to this store.");
      }
      if (requiredTypes.size > 0 && !requiredTypes.has(type)) {
        throw new BookingError("invalid_state", "A selected resource does not match a required type.");
      }
    }
    await db.delete(serviceResources).where(eq(serviceResources.serviceId, serviceId));
    if (resourceIds.length > 0) {
      await db.insert(serviceResources).values(resourceIds.map((resourceId) => ({ serviceId, resourceId })));
    }
  }
};

export const createService = async (storeId: string, input: ServiceWrite) => {
  await assertStore(storeId);
  const inserted = await db
    .insert(services)
    .values({
      businessId: storeId,
      name: input.name,
      description: input.description ?? null,
      durationMin: input.durationMin,
      bufferAfterMin: input.bufferAfterMin ?? 0,
      priceCents: input.priceCents ?? null,
      minParty: input.minParty ?? 1,
      maxParty: input.maxParty ?? input.minParty ?? 1,
      intakeQuestions: input.intakeQuestions ?? [],
      isActive: input.isActive ?? true,
    })
    .returning({ id: services.id });
  const id = inserted[0]?.id;
  if (!id) {
    throw new Error("Service insert failed");
  }
  await saveLinks(storeId, id, input.requirements, input.resourceIds);
  return (await listServices(storeId)).find((service) => service.id === id);
};

export const updateService = async (storeId: string, serviceId: string, input: Partial<ServiceWrite>) => {
  await assertStore(storeId);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.durationMin !== undefined) patch.durationMin = input.durationMin;
  if (input.bufferAfterMin !== undefined) patch.bufferAfterMin = input.bufferAfterMin;
  if (input.priceCents !== undefined) patch.priceCents = input.priceCents;
  if (input.minParty !== undefined) patch.minParty = input.minParty;
  if (input.maxParty !== undefined) patch.maxParty = input.maxParty;
  if (input.intakeQuestions !== undefined) patch.intakeQuestions = input.intakeQuestions;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (Object.keys(patch).length > 0) {
    const updated = await db
      .update(services)
      .set(patch)
      .where(and(eq(services.id, serviceId), eq(services.businessId, storeId)))
      .returning({ id: services.id });
    if (updated.length === 0) {
      throw new BookingError("not_found", "Service not found.");
    }
  }
  await saveLinks(storeId, serviceId, input.requirements, input.resourceIds);
  const service = (await listServices(storeId)).find((item) => item.id === serviceId);
  if (!service) {
    throw new BookingError("not_found", "Service not found.");
  }
  return service;
};

export const listDocuments = async (storeId: string) => {
  await assertStore(storeId);
  const rows = await db
    .select()
    .from(businessDocuments)
    .where(eq(businessDocuments.businessId, storeId))
    .orderBy(desc(businessDocuments.version));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.type)) {
      latest.set(row.type, row);
    }
  }
  return [...latest.values()];
};

export const listDocumentVersions = async (storeId: string, type: string) => {
  await assertStore(storeId);
  return db
    .select()
    .from(businessDocuments)
    .where(and(eq(businessDocuments.businessId, storeId), eq(businessDocuments.type, type)))
    .orderBy(desc(businessDocuments.version));
};

export const saveDocument = async (storeId: string, type: string, title: string, content: string) => {
  await assertStore(storeId);
  const existing = await listDocumentVersions(storeId, type);
  const version = (existing[0]?.version ?? 0) + 1;
  const inserted = await db
    .insert(businessDocuments)
    .values({ businessId: storeId, type, title, content, version })
    .returning();
  return inserted[0];
};

export const listExceptions = async (storeId: string) => {
  await assertStore(storeId);
  return db
    .select()
    .from(availabilityExceptions)
    .where(eq(availabilityExceptions.businessId, storeId))
    .orderBy(asc(availabilityExceptions.startsAt));
};

export const createException = async (input: {
  storeId: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
}) => {
  const store = await assertStore(input.storeId);
  const zone = store.timezone;
  const startDay = DateTime.fromISO(input.date, { zone });
  const endDay = DateTime.fromISO(input.endDate ?? input.date, { zone });
  if (!startDay.isValid || !endDay.isValid) {
    throw new BookingError("invalid_state", "Use dates like 2026-10-23.");
  }
  const startsAt =
    input.startTime !== undefined
      ? startDay.set({ hour: Number(input.startTime.slice(0, 2)), minute: Number(input.startTime.slice(3, 5)) })
      : startDay.startOf("day");
  const endsAt =
    input.endTime !== undefined
      ? endDay.set({ hour: Number(input.endTime.slice(0, 2)), minute: Number(input.endTime.slice(3, 5)) })
      : endDay.plus({ days: 1 }).startOf("day");
  if (endsAt <= startsAt) {
    throw new BookingError("invalid_state", "The closure must end after it starts.");
  }
  const inserted = await db
    .insert(availabilityExceptions)
    .values({
      businessId: input.storeId,
      startsAt: startsAt.toJSDate(),
      endsAt: endsAt.toJSDate(),
      isOpen: false,
      reason: input.reason ?? null,
    })
    .returning();
  return inserted[0];
};

export const deleteException = async (storeId: string, exceptionId: string) => {
  const deleted = await db
    .delete(availabilityExceptions)
    .where(and(eq(availabilityExceptions.id, exceptionId), eq(availabilityExceptions.businessId, storeId)))
    .returning({ id: availabilityExceptions.id });
  if (deleted.length === 0) {
    throw new BookingError("not_found", "Closure not found.");
  }
};
