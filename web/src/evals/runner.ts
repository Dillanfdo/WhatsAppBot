import { eq, inArray } from "drizzle-orm";
import { runAgent } from "@/lib/ai/agent";
import { db } from "@/lib/db";
import { bookingResources, bookings, customers } from "@/lib/db/schema";
import type { AgentResult } from "@/lib/validation";
import { judgeCase, type BookingSnapshot, type EvalCase } from "./judge";

const customerIds = async (phoneNumber: string) =>
  (await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phoneNumber))).map((row) => row.id);

export const deletePhoneBookings = async (phoneNumber: string) => {
  const ids = await customerIds(phoneNumber);
  if (ids.length === 0) return;
  const bookingIds = (await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.customerId, ids))).map((row) => row.id);
  if (bookingIds.length === 0) return;
  await db.delete(bookingResources).where(inArray(bookingResources.bookingId, bookingIds));
  await db.delete(bookings).where(inArray(bookings.id, bookingIds));
};

export const bookingSnapshot = async (phoneNumber: string): Promise<BookingSnapshot> => {
  const ids = await customerIds(phoneNumber);
  if (ids.length === 0) return { count: 0, statuses: [] };
  const rows = await db.select({ status: bookings.status }).from(bookings).where(inArray(bookings.customerId, ids));
  return { count: rows.length, statuses: rows.map((row) => row.status) };
};

/** A cancelled booking must also release its resource, or the slot stays blocked. */
export const hasActiveResourceLock = async (phoneNumber: string): Promise<boolean> => {
  const ids = await customerIds(phoneNumber);
  if (ids.length === 0) return false;
  const rows = await db
    .select({ active: bookingResources.active })
    .from(bookingResources)
    .innerJoin(bookings, eq(bookings.id, bookingResources.bookingId))
    .where(inArray(bookings.customerId, ids));
  return rows.some((row) => row.active);
};

export const runCase = async (item: EvalCase) => {
  await deletePhoneBookings(item.phone);
  const turns: AgentResult[] = [];
  let sessionId: string | undefined;
  for (const message of item.turns) {
    const result = await runAgent({
      storeId: item.storeId,
      phone: item.phone,
      message,
      messageId: crypto.randomUUID(),
      sessionId,
    });
    sessionId = result.conversationId;
    turns.push(result);
  }
  const snapshot = await bookingSnapshot(item.phone);
  const reasons = judgeCase(item, turns, snapshot);
  if (item.expectStatuses?.every((status) => status === "cancelled") && (await hasActiveResourceLock(item.phone))) {
    reasons.push("cancelled booking still holds a resource");
  }
  await deletePhoneBookings(item.phone);
  return {
    id: item.id,
    pass: reasons.length === 0,
    reasons,
    tools: turns.flatMap((turn) => turn.toolCalls.map((call) => call.name)),
  };
};
