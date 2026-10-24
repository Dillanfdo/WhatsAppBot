import { z } from "zod";
import { getAvailableSlots } from "@/lib/booking/slots";
import { bookingErrorBody, bookingErrorStatus, isBookingError } from "@/lib/booking/errors";

const querySchema = z.object({
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int(),
  resourceId: z.uuid().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    serviceId: url.searchParams.get("serviceId") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    partySize: url.searchParams.get("partySize") ?? undefined,
    resourceId: url.searchParams.get("resourceId") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: { code: "invalid_state", message: "serviceId, date, and partySize are required." } },
      { status: 400 },
    );
  }
  try {
    const result = await getAvailableSlots({
      storeId: id,
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      partySize: parsed.data.partySize,
      preferredResourceId: parsed.data.resourceId,
    });
    return Response.json(result);
  } catch (error) {
    if (isBookingError(error)) {
      return Response.json(bookingErrorBody(error), { status: bookingErrorStatus(error.code) });
    }
    throw error;
  }
}