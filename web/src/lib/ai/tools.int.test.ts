import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { createConversation } from "@/lib/ai/conversations";
import { executeTool } from "@/lib/ai/tools";
import { createBooking } from "@/lib/booking/bookings";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { toISO, toDbWeekday } from "@/lib/time";
import { SEED_IDS } from "@/scripts/seed-data";

const ZONE = "Asia/Kolkata";

const salonDay = (): DateTime => {
  for (let offset = 16; offset <= 28; offset += 1) {
    const day = DateTime.now().setZone(ZONE).startOf("day").plus({ days: offset });
    const weekday = toDbWeekday(day);
    if (weekday >= 1 && weekday <= 6) {
      return day;
    }
  }
  throw new Error("No salon day");
};

const phoneA = "+919777700001";
const phoneB = "+919777700002";

describe("tool handlers", () => {
  it("ignores invented identity and requires a prior slot offer", async () => {
    const conversationId = await createConversation(SEED_IDS.salon, phoneA);
    const invented = await executeTool(
      "get_slots",
      {
        service_name: "cut",
        date: salonDay().toFormat("yyyy-MM-dd"),
        store_id: SEED_IDS.restaurant,
        phone: phoneB,
      },
      { storeId: SEED_IDS.salon, phone: phoneA, conversationId },
    );
    expect(invented.ok).toBe(true);
    if (!invented.ok) {
      return;
    }
    const data = invented.data as { serviceName: string; slots: { localTime: string }[] };
    expect(data.serviceName).toBe("Haircut");
    expect(JSON.stringify(data)).not.toContain("Priya");

    const blocked = await executeTool(
      "create_booking",
      {
        service_name: "Haircut",
        date: salonDay().toFormat("yyyy-MM-dd"),
        time: "18:00",
        customer_confirmed: true,
        store_id: SEED_IDS.gameCentre,
      },
      { storeId: SEED_IDS.salon, phone: phoneA, conversationId },
    );
    expect(blocked).toMatchObject({ ok: false, error: { code: "invalid_state" } });

    await db.insert(messages).values({
      conversationId,
      role: "tool",
      content: {
        name: "get_slots",
        ok: true,
        output: {
          data: {
            serviceName: "Haircut",
            date: salonDay().toFormat("yyyy-MM-dd"),
            slots: [{ localTime: "18:00" }],
          },
        },
      },
    });
    const unconfirmed = await executeTool(
      "create_booking",
      {
        service_name: "Haircut",
        date: salonDay().toFormat("yyyy-MM-dd"),
        time: "18:00",
        customer_confirmed: false,
      },
      { storeId: SEED_IDS.salon, phone: phoneA, conversationId },
    );
    expect(unconfirmed).toMatchObject({ ok: false, error: { code: "invalid_state" } });

    const booked = await executeTool(
      "create_booking",
      {
        service_name: "cut",
        date: salonDay().toFormat("yyyy-MM-dd"),
        time: "18:00",
        customer_confirmed: true,
        customer_name: "Asha",
      },
      { storeId: SEED_IDS.salon, phone: phoneA, conversationId },
    );
    expect(booked.ok).toBe(true);
    if (!booked.ok) {
      return;
    }
    const booking = booked.data as { bookingId: string };
    expect(JSON.stringify(booked.data)).not.toContain("Priya");

    const other = await executeTool(
      "cancel_booking",
      { booking_id: booking.bookingId },
      { storeId: SEED_IDS.salon, phone: phoneB, conversationId },
    );
    expect(other).toMatchObject({ ok: false, error: { code: "not_owner" } });

    const unknown = await executeTool(
      "get_slots",
      { service_name: "spaceship", date: salonDay().toFormat("yyyy-MM-dd") },
      { storeId: SEED_IDS.salon, phone: phoneA, conversationId },
    );
    expect(unknown.ok).toBe(false);
    if (unknown.ok) {
      return;
    }
    expect(unknown.error.hint).toContain("Haircut");
  });

  it("does not let customer B read customer A's booking through list", async () => {
    const day = DateTime.now().setZone(ZONE).plus({ days: 11 }).set({ hour: 16, minute: 0, second: 0, millisecond: 0 });
    const record = await createBooking({
      storeId: SEED_IDS.gameCentre,
      serviceId: SEED_IDS.services.gameCentre.oneHour,
      customerPhone: phoneA,
      startsAt: toISO(day),
      partySize: 2,
    });
    const conversationId = await createConversation(SEED_IDS.gameCentre, phoneB);
    const listed = await executeTool("list_my_bookings", {}, { storeId: SEED_IDS.gameCentre, phone: phoneB, conversationId });
    expect(listed.ok).toBe(true);
    if (!listed.ok) {
      return;
    }
    expect(JSON.stringify(listed.data)).not.toContain(record.id);
    const cancelled = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    expect(cancelled).toEqual([]);
  });
});
