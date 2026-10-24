import { z } from "zod";
import { getBooking } from "@/lib/booking/bookings";
import { bookingResponse } from "@/lib/booking/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: { code: "not_found", message: "Booking not found." } }, { status: 404 });
  }
  try {
    return Response.json({ booking: await getBooking(id) });
  } catch (error) {
    return bookingResponse(error);
  }
}
