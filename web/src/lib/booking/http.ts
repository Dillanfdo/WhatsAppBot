import { isBookingError, bookingErrorBody, bookingErrorStatus } from "@/lib/booking/errors";

export const bookingResponse = (error: unknown): Response => {
  if (isBookingError(error)) {
    return Response.json(bookingErrorBody(error), { status: bookingErrorStatus(error.code) });
  }
  console.error(error);
  return Response.json({ error: { code: "internal", message: "Something went wrong." } }, { status: 500 });
};
