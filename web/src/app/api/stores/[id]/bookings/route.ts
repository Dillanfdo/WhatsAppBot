import { z } from "zod";
import { createBooking, listBookings } from "@/lib/booking/bookings";
import { bookingResponse } from "@/lib/booking/http";

const querySchema = z.object({
  status: z.enum(["held", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  phone: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const bodySchema = z.object({
  serviceId: z.uuid(),
  customerPhone: z.string().min(1),
  customerName: z.string().trim().optional(),
  startsAt: z.string().min(1),
  partySize: z.number().int().positive(),
  preferredResourceId: z.uuid().optional(),
});

const storeIdFrom = async (params: Promise<{ id: string }>) => {
  const { id } = await params;
  return z.uuid().safeParse(id).success ? id : null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await storeIdFrom(context.params);
  if (!id) {
    return Response.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
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
      storeId: id,
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await storeIdFrom(context.params);
  if (!id) {
    return Response.json({ error: { code: "not_found", message: "Store not found." } }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_state", message: "Expected JSON." } }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_state", message: "Invalid booking." } }, { status: 400 });
  }
  try {
    const booking = await createBooking({ storeId: id, ...parsed.data });
    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    return bookingResponse(error);
  }
}
