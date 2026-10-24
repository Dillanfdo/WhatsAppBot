import { eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/stores/[id]/slots/route";
import {
  cancelBooking,
  confirmHeldBooking,
  createBooking,
  rescheduleBooking,
} from "@/lib/booking/bookings";
import { getPolicy } from "@/lib/booking/policy";
import { getAvailableSlots } from "@/lib/booking/slots";
import { db } from "@/lib/db";
import {
  availabilityRules,
  bookingResources,
  bookings,
  businesses,
  customers,
  resources,
  serviceResourceRequirements,
  serviceResources,
  services,
} from "@/lib/db/schema";
import { toISO, toDbWeekday } from "@/lib/time";
import { SEED_IDS } from "@/scripts/seed-data";

const ZONE = "Asia/Kolkata";
const createdBusinessIds: string[] = [];

const dayFromNow = (days: number): DateTime =>
  DateTime.now().setZone(ZONE).startOf("day").plus({ days });

const isoDate = (day: DateTime): string => day.toFormat("yyyy-MM-dd");

const at = (day: DateTime, time: string): string => {
  const [hour, minute] = time.split(":");
  return toISO(
    day.set({
      hour: Number(hour),
      minute: Number(minute),
      second: 0,
      millisecond: 0,
    }),
  );
};

const nextWeekday = (minDays: number, maxDays: number, avoid: number[] = []): string => {
  const skipped = new Set(avoid);
  for (let offset = minDays; offset <= maxDays; offset += 1) {
    if (skipped.has(offset)) {
      continue;
    }
    const day = dayFromNow(offset);
    const weekday = toDbWeekday(day);
    if (weekday >= 1 && weekday <= 5) {
      return isoDate(day);
    }
  }
  throw new Error("No weekday in range");
};

const nextSalonDay = (avoid: number[]): DateTime => {
  const skipped = new Set(avoid);
  for (let offset = 2; offset <= 27; offset += 1) {
    if (skipped.has(offset)) {
      continue;
    }
    const day = dayFromNow(offset);
    const weekday = toDbWeekday(day);
    if (weekday >= 1 && weekday <= 6) {
      return day;
    }
  }
  throw new Error("No salon day in range");
};

const phone = (n: number): string => `+9198888${String(n).padStart(5, "0")}`;

let phoneSerial = 100;

const nextPhone = (): string => {
  phoneSerial += 1;
  return phone(phoneSerial);
};

const deleteBusiness = async (businessId: string): Promise<void> => {
  const bookingIds = db.select({ id: bookings.id }).from(bookings).where(eq(bookings.businessId, businessId));
  await db.delete(bookingResources).where(inArray(bookingResources.bookingId, bookingIds));
  await db.delete(bookings).where(eq(bookings.businessId, businessId));
  await db.delete(customers).where(eq(customers.businessId, businessId));
  const serviceIds = db.select({ id: services.id }).from(services).where(eq(services.businessId, businessId));
  await db.delete(serviceResources).where(inArray(serviceResources.serviceId, serviceIds));
  await db.delete(serviceResourceRequirements).where(inArray(serviceResourceRequirements.serviceId, serviceIds));
  await db.delete(services).where(eq(services.businessId, businessId));
  await db.delete(availabilityRules).where(eq(availabilityRules.businessId, businessId));
  await db.delete(resources).where(eq(resources.businessId, businessId));
  await db.delete(businesses).where(eq(businesses.id, businessId));
};

afterAll(async () => {
  for (const id of createdBusinessIds) {
    await deleteBusiness(id);
  }
});

describe("seeded stores", () => {
  it("offers Priya through the afternoon and keeps Arjun on a split shift", async () => {
    const day = nextSalonDay([3, 14]);
    const slots = await getAvailableSlots({
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.haircut,
      date: isoDate(day),
      partySize: 1,
      preferredResourceId: SEED_IDS.resources.salon.arjun,
    });
    const times = slots.slots.map((slot) => slot.localTime);
    expect(times).toContain("10:00");
    expect(times).toContain("17:00");
    expect(times).not.toContain("15:00");
    expect(slots.slots[0]?.resourceNames).toEqual(["Arjun"]);
  });

  it("closes the salon on the seeded holiday and Arjun on leave", async () => {
    const holiday = await getAvailableSlots({
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.haircut,
      date: isoDate(dayFromNow(14)),
      partySize: 1,
    });
    expect(holiday.slots).toEqual([]);

    const leaveDay = dayFromNow(3);
    const arjun = await getAvailableSlots({
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.haircut,
      date: isoDate(leaveDay),
      partySize: 1,
      preferredResourceId: SEED_IDS.resources.salon.arjun,
    });
    expect(arjun.slots).toEqual([]);
    if (toDbWeekday(leaveDay) !== 0) {
      const priya = await getAvailableSlots({
        storeId: SEED_IDS.salon,
        serviceId: SEED_IDS.services.salon.haircut,
        date: isoDate(leaveDay),
        partySize: 1,
        preferredResourceId: SEED_IDS.resources.salon.priya,
      });
      expect(priya.slots.length).toBeGreaterThan(0);
    }
  });

  it("removes the restaurant lunch service on the closure and keeps dinner", async () => {
    const slots = await getAvailableSlots({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      date: isoDate(dayFromNow(7)),
      partySize: 2,
    });
    const times = slots.slots.map((slot) => slot.localTime);
    expect(times).not.toContain("12:00");
    expect(times).toContain("19:00");
    expect(slots.slots[0]?.resourceNames).toBeUndefined();
  });

  it("puts a party of 4 on the smallest fitting table", async () => {
    const day = dayFromNow(4);
    const record = await createBooking({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      customerPhone: nextPhone(),
      startsAt: at(day, "19:00"),
      partySize: 4,
    });
    const links = await db
      .select({ resourceId: bookingResources.resourceId })
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, record.id));
    expect(links.map((link) => link.resourceId)).toEqual([SEED_IDS.resources.restaurant.t3]);
    expect(record.resourceNames).toEqual(["T3"]);
    expect(record.price).toBe("no charge");
  });

  it("rejects a party that is too large", async () => {
    await expect(
      createBooking({
        storeId: SEED_IDS.restaurant,
        serviceId: SEED_IDS.services.restaurant.tableReservation,
        customerPhone: nextPhone(),
        startsAt: at(dayFromNow(5), "19:00"),
        partySize: 8,
      }),
    ).rejects.toMatchObject({ code: "invalid_party_size" });
  });

  it("offers a later end for a shorter game-centre service", async () => {
    const date = nextWeekday(2, 18);
    const shortSlots = await getAvailableSlots({
      storeId: SEED_IDS.gameCentre,
      serviceId: SEED_IDS.services.gameCentre.oneHour,
      date,
      partySize: 4,
    });
    const longSlots = await getAvailableSlots({
      storeId: SEED_IDS.gameCentre,
      serviceId: SEED_IDS.services.gameCentre.threeHours,
      date,
      partySize: 4,
    });
    expect(shortSlots.slots.map((slot) => slot.localTime)).toContain("21:00");
    expect(longSlots.slots.map((slot) => slot.localTime)).not.toContain("21:00");
    const noon = longSlots.slots.find((slot) => slot.localTime === "12:00");
    expect(noon?.endsAt).toBe(at(DateTime.fromISO(date, { zone: ZONE }), "15:00"));
  });

  it("blocks the buffer after a colour appointment but allows the next grid start", async () => {
    const day = nextSalonDay([3, 14]);
    await createBooking({
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.hairColour,
      customerPhone: nextPhone(),
      startsAt: at(day, "10:00"),
      partySize: 1,
    });
    const slots = await getAvailableSlots({
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.hairColour,
      date: isoDate(day),
      partySize: 1,
    });
    const times = slots.slots.map((slot) => slot.localTime);
    expect(times).not.toContain("12:00");
    expect(times).toContain("12:15");
  });

  it("returns the same booking for the same customer, service, and start", async () => {
    const day = nextSalonDay([3, 14]);
    const input = {
      storeId: SEED_IDS.salon,
      serviceId: SEED_IDS.services.salon.beardTrim,
      customerPhone: nextPhone(),
      startsAt: at(day, "11:00"),
      partySize: 1,
      idempotencyKey: `idem-${phoneSerial}`,
    };
    const first = await createBooking(input);
    const second = await createBooking(input);
    expect(second.id).toBe(first.id);
  });

  it("refuses another customer's cancel and allows the owner outside the window", async () => {
    const laterDay = dayFromNow(10);
    const owner = nextPhone();
    const later = await createBooking({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      customerPhone: owner,
      startsAt: at(laterDay, "19:30"),
      partySize: 2,
    });
    await expect(
      cancelBooking({
        storeId: SEED_IDS.restaurant,
        bookingId: later.id,
        customerPhone: nextPhone(),
      }),
    ).rejects.toMatchObject({ code: "not_owner" });
    const cancelled = await cancelBooking({
      storeId: SEED_IDS.restaurant,
      bookingId: later.id,
      customerPhone: owner,
    });
    expect(cancelled.status).toBe("cancelled");
  });

  it("frees only the cancelled table", async () => {
    const day = dayFromNow(6);
    const first = await createBooking({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      customerPhone: nextPhone(),
      startsAt: at(day, "20:00"),
      partySize: 2,
    });
    const second = await createBooking({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      customerPhone: nextPhone(),
      startsAt: at(day, "20:00"),
      partySize: 2,
    });
    expect(first.resourceNames).toEqual(["T1"]);
    expect(second.resourceNames).toEqual(["T2"]);
    await cancelBooking({
      storeId: SEED_IDS.restaurant,
      bookingId: first.id,
      byAdmin: true,
    });
    const third = await createBooking({
      storeId: SEED_IDS.restaurant,
      serviceId: SEED_IDS.services.restaurant.tableReservation,
      customerPhone: nextPhone(),
      startsAt: at(day, "20:00"),
      partySize: 2,
    });
    expect(third.resourceNames).toEqual(["T1"]);
    const stillHeld = await db
      .select({ active: bookingResources.active })
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, second.id));
    expect(stillHeld.every((row) => row.active)).toBe(true);
  });

  it("leaves the original booking in place when a reschedule is outside hours", async () => {
    const day = dayFromNow(8);
    const record = await createBooking({
      storeId: SEED_IDS.gameCentre,
      serviceId: SEED_IDS.services.gameCentre.twoHours,
      customerPhone: nextPhone(),
      startsAt: at(day, "16:00"),
      partySize: 4,
    });
    await expect(
      rescheduleBooking({
        storeId: SEED_IDS.gameCentre,
        bookingId: record.id,
        customerPhone: record.customerPhone,
        newStartsAt: at(day, "03:00"),
      }),
    ).rejects.toMatchObject({ code: "outside_hours" });
    const links = await db
      .select({ active: bookingResources.active })
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, record.id));
    expect(links.every((row) => row.active)).toBe(true);
    const row = await db.select({ startsAt: bookings.startsAt }).from(bookings).where(eq(bookings.id, record.id));
    expect(row[0]?.startsAt.toISOString()).toBe(new Date(record.startsAt).toISOString());
  });

  it("quotes the latest privacy policy", async () => {
    const text = await getPolicy(SEED_IDS.salon, "privacy");
    expect(text).toContain("SAMPLE TEXT - replace before going live. Not legal advice.");
  });

  it("serves slots over HTTP", async () => {
    const date = isoDate(nextSalonDay([3, 14]));
    const response = await GET(
      new Request(
        `http://localhost/api/stores/${SEED_IDS.salon}/slots?serviceId=${SEED_IDS.services.salon.haircut}&date=${date}&partySize=1`,
      ),
      { params: Promise.resolve({ id: SEED_IDS.salon }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { slots: { localTime: string }[] };
    expect(body.slots.length).toBeGreaterThan(0);
  });
});

describe("fixture rules", () => {
  const insertHours = async (businessId: string) => {
    await db.insert(availabilityRules).values(
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        businessId,
        weekday,
        startTime: "09:00:00",
        endTime: "18:00:00",
      })),
    );
  };

  const makeStore = async (config: Record<string, unknown>, interval = 30) => {
    const inserted = await db
      .insert(businesses)
      .values({
        name: "Fixture",
        type: "clinic",
        timezone: ZONE,
        slotIntervalMin: interval,
        isActive: false,
        config,
      })
      .returning({ id: businesses.id });
    const id = inserted[0]?.id;
    if (!id) {
      throw new Error("fixture store missing");
    }
    createdBusinessIds.push(id);
    await insertHours(id);
    return id;
  };

  it("enforces notice, horizon, weekdays, buffers, and back-to-back ranges", async () => {
    const storeId = await makeStore({
      min_notice_hours: 1000,
      max_days_ahead: 30,
      auto_confirm: true,
      cancellation_window_hours: 0,
      bookable_weekdays: [1, 2, 3, 4, 5, 6],
    });
    const [resource] = await db
      .insert(resources)
      .values({ businessId: storeId, type: "staff", name: "Sam", capacity: 1 })
      .returning({ id: resources.id });
    const [service] = await db
      .insert(services)
      .values({
        businessId: storeId,
        name: "Consult",
        durationMin: 60,
        bufferAfterMin: 0,
        priceCents: 10000,
        minParty: 1,
        maxParty: 1,
      })
      .returning({ id: services.id });
    if (!resource || !service) {
      throw new Error("fixture rows missing");
    }
    await db.insert(serviceResourceRequirements).values({
      serviceId: service.id,
      resourceType: "staff",
      quantity: 1,
    });

    await expect(
      createBooking({
        storeId,
        serviceId: service.id,
        customerPhone: nextPhone(),
        startsAt: at(dayFromNow(2), "10:00"),
        partySize: 1,
      }),
    ).rejects.toMatchObject({ code: "too_soon" });

    await db
      .update(businesses)
      .set({
        config: {
          min_notice_hours: 0,
          max_days_ahead: 30,
          auto_confirm: false,
          cancellation_window_hours: 48,
          bookable_weekdays: [1],
        },
      })
      .where(eq(businesses.id, storeId));

    const notMonday = dayFromNow(2);
    const closedDay = toDbWeekday(notMonday) === 1 ? notMonday.plus({ days: 1 }) : notMonday;
    await expect(
      createBooking({
        storeId,
        serviceId: service.id,
        customerPhone: nextPhone(),
        startsAt: at(closedDay, "10:00"),
        partySize: 1,
      }),
    ).rejects.toMatchObject({ code: "closed_that_day" });

    await db
      .update(businesses)
      .set({
        config: {
          min_notice_hours: 0,
          max_days_ahead: 2,
          auto_confirm: false,
          cancellation_window_hours: 48,
          bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
        },
      })
      .where(eq(businesses.id, storeId));

    await expect(
      createBooking({
        storeId,
        serviceId: service.id,
        customerPhone: nextPhone(),
        startsAt: at(dayFromNow(5), "10:00"),
        partySize: 1,
      }),
    ).rejects.toMatchObject({ code: "too_far" });

    await db
      .update(businesses)
      .set({
        config: {
          min_notice_hours: 0,
          max_days_ahead: 30,
          auto_confirm: false,
          cancellation_window_hours: 48,
          bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
        },
      })
      .where(eq(businesses.id, storeId));

    const held = await createBooking({
      storeId,
      serviceId: service.id,
      customerPhone: nextPhone(),
      startsAt: at(dayFromNow(1), "10:00"),
      partySize: 1,
    });
    await expect(
      cancelBooking({ storeId, bookingId: held.id, customerPhone: held.customerPhone }),
    ).rejects.toMatchObject({ code: "cancellation_window_passed" });
    const confirmed = await confirmHeldBooking(storeId, held.id);
    expect(confirmed.status).toBe("confirmed");

    await db
      .update(businesses)
      .set({
        config: {
          min_notice_hours: 0,
          max_days_ahead: 30,
          auto_confirm: true,
          cancellation_window_hours: 0,
          bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
        },
      })
      .where(eq(businesses.id, storeId));

    const first = await createBooking({
      storeId,
      serviceId: service.id,
      customerPhone: nextPhone(),
      startsAt: at(dayFromNow(2), "10:00"),
      partySize: 1,
    });
    expect(first.status).toBe("confirmed");
    const backToBack = await createBooking({
      storeId,
      serviceId: service.id,
      customerPhone: nextPhone(),
      startsAt: at(dayFromNow(2), "11:00"),
      partySize: 1,
    });
    expect(backToBack.id).not.toBe(first.id);

    await db.update(services).set({ bufferAfterMin: 30 }).where(eq(services.id, service.id));
    await expect(
      createBooking({
        storeId,
        serviceId: service.id,
        customerPhone: nextPhone(),
        startsAt: at(dayFromNow(3), "10:00"),
        partySize: 1,
      }).then(async (early) => {
        await expect(
          createBooking({
            storeId,
            serviceId: service.id,
            customerPhone: nextPhone(),
            startsAt: at(dayFromNow(3), "11:00"),
            partySize: 1,
          }),
        ).rejects.toMatchObject({ code: "slot_taken" });
        return early;
      }),
    ).resolves.toMatchObject({ status: "confirmed" });

    await expect(
      createBooking({
        storeId,
        serviceId: service.id,
        customerPhone: nextPhone(),
        startsAt: at(dayFromNow(2), "10:00"),
        partySize: 1,
        requireActive: true,
      }),
    ).rejects.toMatchObject({ code: "store_inactive" });
  });

  it("books staff and chair together", async () => {
    const storeId = await makeStore({
      min_notice_hours: 0,
      max_days_ahead: 30,
      auto_confirm: true,
      cancellation_window_hours: 1,
      bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    const insertedResources = await db
      .insert(resources)
      .values([
        { businessId: storeId, type: "staff", name: "Dentist", capacity: 1 },
        { businessId: storeId, type: "chair", name: "Chair 1", capacity: 1 },
      ])
      .returning({ id: resources.id, type: resources.type });
    const [service] = await db
      .insert(services)
      .values({
        businessId: storeId,
        name: "Checkup",
        durationMin: 30,
        bufferAfterMin: 0,
        priceCents: 50000,
        minParty: 1,
        maxParty: 1,
      })
      .returning({ id: services.id });
    if (!service) {
      throw new Error("service missing");
    }
    await db.insert(serviceResourceRequirements).values([
      { serviceId: service.id, resourceType: "staff", quantity: 1 },
      { serviceId: service.id, resourceType: "chair", quantity: 1 },
    ]);
    const record = await createBooking({
      storeId,
      serviceId: service.id,
      customerPhone: nextPhone(),
      customerName: "Asha",
      startsAt: at(dayFromNow(2), "09:00"),
      partySize: 1,
    });
    expect(record.resourceNames.sort()).toEqual(["Chair 1", "Dentist"]);
    const links = await db
      .select({ active: bookingResources.active, resourceId: bookingResources.resourceId })
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, record.id));
    expect(links).toHaveLength(insertedResources.length);
    expect(links.every((link) => link.active)).toBe(true);
    const cancelled = await cancelBooking({
      storeId,
      bookingId: record.id,
      customerPhone: record.customerPhone,
    });
    expect(cancelled.status).toBe("cancelled");
    const after = await db
      .select({ active: bookingResources.active })
      .from(bookingResources)
      .where(eq(bookingResources.bookingId, record.id));
    expect(after.every((link) => link.active === false)).toBe(true);
  });

  it("lets exactly one of twenty callers take a single resource", async () => {
    const storeId = await makeStore(
      {
        min_notice_hours: 0,
        max_days_ahead: 30,
        auto_confirm: true,
        cancellation_window_hours: 0,
        max_active_bookings_per_customer: 5,
        bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
      60,
    );
    await db.insert(resources).values({ businessId: storeId, type: "room", name: "Room", capacity: 1 });
    const [service] = await db
      .insert(services)
      .values({
        businessId: storeId,
        name: "Hour",
        durationMin: 60,
        bufferAfterMin: 0,
        priceCents: 100,
        minParty: 1,
        maxParty: 1,
      })
      .returning({ id: services.id });
    if (!service) {
      throw new Error("service missing");
    }
    await db.insert(serviceResourceRequirements).values({
      serviceId: service.id,
      resourceType: "room",
      quantity: 1,
    });
    const startsAt = at(dayFromNow(2), "12:00");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createBooking({
          storeId,
          serviceId: service.id,
          customerPhone: phone(200 + index),
          startsAt,
          partySize: 1,
        }).then(
          () => "ok" as const,
          (error: unknown) => (error as { code?: string }).code ?? "error",
        ),
      ),
    );
    expect(results.filter((result) => result === "ok")).toHaveLength(1);
    expect(results.filter((result) => result === "slot_taken")).toHaveLength(19);
  });

  it("lets exactly three of twenty callers take three resources", async () => {
    const storeId = await makeStore(
      {
        min_notice_hours: 0,
        max_days_ahead: 30,
        auto_confirm: true,
        cancellation_window_hours: 0,
        bookable_weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
      60,
    );
    await db.insert(resources).values([
      { businessId: storeId, type: "room", name: "A", capacity: 1 },
      { businessId: storeId, type: "room", name: "B", capacity: 1 },
      { businessId: storeId, type: "room", name: "C", capacity: 1 },
    ]);
    const [service] = await db
      .insert(services)
      .values({
        businessId: storeId,
        name: "Hour",
        durationMin: 60,
        bufferAfterMin: 0,
        priceCents: 100,
        minParty: 1,
        maxParty: 1,
      })
      .returning({ id: services.id });
    if (!service) {
      throw new Error("service missing");
    }
    await db.insert(serviceResourceRequirements).values({
      serviceId: service.id,
      resourceType: "room",
      quantity: 1,
    });
    const startsAt = at(dayFromNow(2), "15:00");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        createBooking({
          storeId,
          serviceId: service.id,
          customerPhone: phone(300 + index),
          startsAt,
          partySize: 1,
        }).then(
          () => "ok" as const,
          (error: unknown) => (error as { code?: string }).code ?? "error",
        ),
      ),
    );
    expect(results.filter((result) => result === "ok")).toHaveLength(3);
    expect(results.filter((result) => result === "slot_taken")).toHaveLength(17);
  });
});
