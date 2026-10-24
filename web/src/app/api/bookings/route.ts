import { z } from "zod";
import { listBookings } from "@/lib/booking/bookings";
import { bookingResponse } from "@/lib/booking/http";

const querySchema = z.object({
  storeId: z.uuid().optional(),
  status: z.enum(["held", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    storeId: url.searchParams.get("storeId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    phone: url.searchParams.get("phone") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_state", message: "Invalid booking filters." } }, { status: 400 });
  }
  try {
    return Response.json(await listBookings({
      storeId: parsed.data.storeId,
      status: parsed.data.status,
      from: parsed.data.from,
      to: parsed.data.to,
      customerPhone: parsed.data.phone,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    }));
  } catch (error) {
    return bookingResponse(error);
  }
}
