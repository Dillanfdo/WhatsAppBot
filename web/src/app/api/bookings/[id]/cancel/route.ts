import { z } from "zod";
import { cancelBooking } from "@/lib/booking/bookings";
import { bookingResponse } from "@/lib/booking/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: { code: "not_found", message: "Booking not found." } }, { status: 404 });
  }
  let storeId = "";
  try {
    const body = (await request.json()) as { storeId?: string };
    storeId = body.storeId ?? "";
  } catch {
    return Response.json({ error: { code: "invalid_state", message: "Expected JSON." } }, { status: 400 });
  }
  if (!z.uuid().safeParse(storeId).success) {
    return Response.json({ error: { code: "invalid_state", message: "storeId is required." } }, { status: 400 });
  }
  try {
    const booking = await cancelBooking({ storeId, bookingId: id, byAdmin: true });
    return Response.json({ booking });
  } catch (error) {
    return bookingResponse(error);
  }
}
