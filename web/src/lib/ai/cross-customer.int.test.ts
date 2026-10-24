import { DateTime } from "luxon";
import { afterAll, expect, it } from "vitest";
import { GET } from "@/app/api/bookings/route";
import { cancelBooking, createBooking } from "@/lib/booking/bookings";
import { executeTool } from "@/lib/ai/tools";
import { SEED_IDS } from "@/scripts/seed-data";

const phoneA = "+919555500001";
const phoneB = "+919555500002";
let bookingId = "";

afterAll(async () => {
  if (!bookingId) return;
  await cancelBooking({
    storeId: SEED_IDS.salon,
    bookingId,
    byAdmin: true,
  });
});

it("phone B cannot list or cancel phone A's booking", async () => {
  let start = DateTime.now().setZone("Asia/Kolkata").plus({ days: 18 }).set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
  if (start.weekday === 7) start = start.plus({ days: 1 });
  const created = await createBooking({
    storeId: SEED_IDS.salon,
    serviceId: SEED_IDS.services.salon.haircut,
    customerPhone: phoneA,
    startsAt: start.toISO() ?? "",
    partySize: 1,
    idempotencyKey: `cross-${start.toISODate()}`,
  });
  bookingId = created.id;

  const listed = await executeTool("list_my_bookings", {}, {
    storeId: SEED_IDS.salon,
    phone: phoneB,
    conversationId: "00000000-0000-4000-8000-000000000099",
  });
  expect(JSON.stringify(listed)).not.toContain(bookingId);

  const cancelled = await executeTool("cancel_booking", { booking_id: bookingId }, {
    storeId: SEED_IDS.salon,
    phone: phoneB,
    conversationId: "00000000-0000-4000-8000-000000000099",
  });
  expect(cancelled.ok).toBe(false);

  const response = await GET(new Request(`http://localhost/api/bookings?storeId=${SEED_IDS.salon}&phone=${encodeURIComponent(phoneB)}`));
  const body = await response.json() as { bookings?: { id: string }[] };
  expect(body.bookings?.some((row) => row.id === bookingId)).toBe(false);
});
