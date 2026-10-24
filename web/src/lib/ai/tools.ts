import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  cancelBooking,
  createBooking,
  listBookings,
  rescheduleBooking,
  type BookingRecord,
} from "@/lib/booking/bookings";
import { BookingError, isBookingError } from "@/lib/booking/errors";
import { getPolicy, isPolicyType } from "@/lib/booking/policy";
import { getAvailableSlots } from "@/lib/booking/slots";
import { db } from "@/lib/db";
import { businesses, messages, resources, services } from "@/lib/db/schema";
import type { ToolHandlerResult } from "@/lib/ai/agent-loop";
import type { LlmToolDefinition } from "@/lib/ai/llm/types";
import { toISO } from "@/lib/time";

export type { ToolHandlerResult };

export type ToolContext = {
  storeId: string;
  phone: string;
  conversationId: string;
};

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const getSlotsArgs = z.object({
  service_name: z.string().trim().min(1),
  date: dateSchema,
  party_size: z.number().int().positive().optional(),
  preferred_staff: z.string().trim().min(1).optional(),
});

const createBookingArgs = z.object({
  service_name: z.string().trim().min(1),
  date: dateSchema,
  time: timeSchema,
  party_size: z.number().int().positive().optional(),
  customer_name: z.string().trim().min(1).optional(),
  intake_answers: z.record(z.string(), z.unknown()).optional(),
  customer_confirmed: z.boolean(),
});

const cancelArgs = z.object({
  booking_id: z.uuid(),
});

const rescheduleArgs = z.object({
  booking_id: z.uuid(),
  new_date: dateSchema,
  new_time: timeSchema,
});

const policyArgs = z.object({
  type: z.enum(["privacy", "terms", "cancellation", "no_show", "faq", "rules", "price_list"]),
});

const emptyArgs = z.object({});

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const agentToolDefinitions: LlmToolDefinition[] = [
  {
    name: "get_slots",
    description: "List bookable start times for a service on one date. Call this before offering any time.",
    parameters: objectSchema(
      {
        service_name: { type: "string", description: "Service name, such as Haircut." },
        date: { type: "string", description: "Date in YYYY-MM-DD, in the store timezone." },
        party_size: { type: "integer", description: "People in the party. Defaults to the service minimum." },
        preferred_staff: { type: "string", description: "Optional staff or resource name." },
      },
      ["service_name", "date"],
    ),
  },
  {
    name: "create_booking",
    description:
      "Book a time that get_slots already returned. Only call this after the customer explicitly says yes, with customer_confirmed true.",
    parameters: objectSchema(
      {
        service_name: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "24-hour HH:MM in the store timezone." },
        party_size: { type: "integer" },
        customer_name: { type: "string" },
        intake_answers: { type: "object", additionalProperties: true },
        customer_confirmed: { type: "boolean" },
      },
      ["service_name", "date", "time", "customer_confirmed"],
    ),
  },
  {
    name: "list_my_bookings",
    description: "List this customer's bookings. Takes no arguments.",
    parameters: objectSchema({}, []),
  },
  {
    name: "cancel_booking",
    description: "Cancel one of this customer's bookings.",
    parameters: objectSchema({ booking_id: { type: "string" } }, ["booking_id"]),
  },
  {
    name: "reschedule_booking",
    description: "Move one of this customer's bookings to a new date and time.",
    parameters: objectSchema(
      {
        booking_id: { type: "string" },
        new_date: { type: "string", description: "YYYY-MM-DD" },
        new_time: { type: "string", description: "HH:MM" },
      },
      ["booking_id", "new_date", "new_time"],
    ),
  },
  {
    name: "get_policy",
    description: "Fetch the store's exact wording for a policy or FAQ.",
    parameters: objectSchema(
      {
        type: {
          type: "string",
          enum: ["privacy", "terms", "cancellation", "no_show", "faq", "rules", "price_list"],
        },
      },
      ["type"],
    ),
  },
];

const schemas: Record<string, z.ZodType> = {
  get_slots: getSlotsArgs,
  create_booking: createBookingArgs,
  list_my_bookings: emptyArgs,
  cancel_booking: cancelArgs,
  reschedule_booking: rescheduleArgs,
  get_policy: policyArgs,
};

const fail = (code: string, message: string, hint?: string): ToolHandlerResult => ({
  ok: false,
  error: { code, message, ...(hint ? { hint } : {}) },
});

const fromBookingError = (error: BookingError): ToolHandlerResult =>
  fail(error.code, error.message, error.hint);

const publicBooking = (
  record: BookingRecord,
  cancellationWindowHours: number,
) => ({
  bookingId: record.id,
  shortCode: record.id.slice(0, 8),
  status: record.status,
  serviceName: record.serviceName,
  localLabel: record.localLabel,
  partySize: record.partySize,
  price: record.price,
  cancellationWindowHours,
});

const cancellationHours = async (storeId: string): Promise<number> => {
  const rows = await db
    .select({ config: businesses.config, timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, storeId))
    .limit(1);
  return rows[0]?.config.cancellation_window_hours ?? 0;
};

const resolveService = async (storeId: string, serviceName: string) => {
  const rows = await db
    .select({ id: services.id, name: services.name, minParty: services.minParty })
    .from(services)
    .where(and(eq(services.businessId, storeId), eq(services.isActive, true)))
    .orderBy(asc(services.name));
  const needle = serviceName.trim().toLowerCase();
  const exact = rows.filter((row) => row.name.toLowerCase() === needle);
  const match = exact.length === 1 ? exact : rows.filter((row) => row.name.toLowerCase().includes(needle));
  if (match.length === 1 && match[0]) {
    return { ok: true as const, service: match[0] };
  }
  const names = rows.map((row) => row.name).join(", ");
  return {
    ok: false as const,
    error: fail(
      "not_found",
      match.length === 0 ? `No service matches "${serviceName}".` : `"${serviceName}" matches more than one service.`,
      names.length > 0 ? `Valid services: ${names}.` : "This store has no active services.",
    ),
  };
};

const resolveResource = async (storeId: string, name: string) => {
  const rows = await db
    .select({ id: resources.id, name: resources.name })
    .from(resources)
    .where(and(eq(resources.businessId, storeId), eq(resources.isActive, true)))
    .orderBy(asc(resources.name));
  const needle = name.trim().toLowerCase();
  const exact = rows.filter((row) => row.name.toLowerCase() === needle);
  const match = exact.length === 1 ? exact : rows.filter((row) => row.name.toLowerCase().includes(needle));
  if (match.length === 1 && match[0]) {
    return { ok: true as const, resourceId: match[0].id };
  }
  return {
    ok: false as const,
    error: fail(
      "not_found",
      `No staff or resource matches "${name}".`,
      `Names: ${rows.map((row) => row.name).join(", ")}.`,
    ),
  };
};

const slotWasOffered = async (
  conversationId: string,
  serviceName: string,
  date: string,
  time: string,
): Promise<boolean> => {
  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.role, "tool")));
  return rows.some((row) => {
    const content = row.content as {
      name?: string;
      ok?: boolean;
      output?: { data?: { serviceName?: string; date?: string; slots?: { localTime?: string }[] } };
    };
    if (content.name !== "get_slots" || content.ok !== true) {
      return false;
    }
    const data = content.output?.data;
    if (!data || data.date !== date || data.serviceName?.toLowerCase() !== serviceName.toLowerCase()) {
      return false;
    }
    return (data.slots ?? []).some((slot) => slot.localTime === time);
  });
};

const run = async (work: () => Promise<ToolHandlerResult>): Promise<ToolHandlerResult> => {
  try {
    return await work();
  } catch (error) {
    if (isBookingError(error)) {
      return fromBookingError(error);
    }
    throw error;
  }
};

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolHandlerResult> {
  const schema = schemas[name];
  if (!schema) {
    return fail("not_found", `Unknown tool ${name}.`);
  }
  const parsed = schema.safeParse(rawArgs);
  if (!parsed.success) {
    return fail("invalid_state", "Those arguments are not valid.", parsed.error.issues.map((issue) => issue.message).join(" "));
  }
  const args = parsed.data as Record<string, unknown>;

  if (name === "get_slots") {
    const input = args as z.infer<typeof getSlotsArgs>;
    const service = await resolveService(context.storeId, input.service_name);
    if (!service.ok) {
      return service.error;
    }
    let preferredResourceId: string | undefined;
    if (input.preferred_staff) {
      const resource = await resolveResource(context.storeId, input.preferred_staff);
      if (!resource.ok) {
        return resource.error;
      }
      preferredResourceId = resource.resourceId;
    }
    return run(async () => {
      const slots = await getAvailableSlots({
        storeId: context.storeId,
        serviceId: service.service.id,
        date: input.date,
        partySize: input.party_size ?? service.service.minParty,
        preferredResourceId,
      });
      return {
        ok: true,
        data: {
          serviceName: service.service.name,
          date: input.date,
          partySize: input.party_size ?? service.service.minParty,
          slots: slots.slots.map((slot) => ({
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            localTime: slot.localTime,
            localLabel: slot.localLabel,
          })),
          ...(slots.note ? { note: slots.note } : {}),
        },
      };
    });
  }

  if (name === "create_booking") {
    const input = args as z.infer<typeof createBookingArgs>;
    if (input.customer_confirmed !== true) {
      return fail("invalid_state", "Ask the customer to confirm before booking.", "Set customer_confirmed to true only after an explicit yes.");
    }
    const service = await resolveService(context.storeId, input.service_name);
    if (!service.ok) {
      return service.error;
    }
    const offered = await slotWasOffered(context.conversationId, service.service.name, input.date, input.time);
    if (!offered) {
      return fail(
        "invalid_state",
        "That time was not offered in this conversation.",
        "Call get_slots for this service, date, and party size, then book one of the returned times.",
      );
    }
    const store = await db
      .select({ timezone: businesses.timezone })
      .from(businesses)
      .where(eq(businesses.id, context.storeId))
      .limit(1);
    const timezone = store[0]?.timezone ?? "Asia/Kolkata";
    const startsAt = `${input.date}T${input.time}:00`;
    return run(async () => {
      const start = DateTime.fromISO(startsAt, { zone: timezone });
      const record = await createBooking({
        storeId: context.storeId,
        serviceId: service.service.id,
        customerPhone: context.phone,
        customerName: input.customer_name,
        startsAt: toISO(start),
        partySize: input.party_size ?? service.service.minParty,
        answers: input.intake_answers,
      });
      const windowHours = await cancellationHours(context.storeId);
      return { ok: true, data: publicBooking(record, windowHours) };
    });
  }

  if (name === "list_my_bookings") {
    return run(async () => {
      const listed = await listBookings({ storeId: context.storeId, customerPhone: context.phone, limit: 10 });
      const windowHours = await cancellationHours(context.storeId);
      return {
        ok: true,
        data: { bookings: listed.bookings.map((record) => publicBooking(record, windowHours)) },
      };
    });
  }

  if (name === "cancel_booking") {
    const input = args as z.infer<typeof cancelArgs>;
    return run(async () => {
      const record = await cancelBooking({
        storeId: context.storeId,
        bookingId: input.booking_id,
        customerPhone: context.phone,
      });
      return { ok: true, data: publicBooking(record, await cancellationHours(context.storeId)) };
    });
  }

  if (name === "reschedule_booking") {
    const input = args as z.infer<typeof rescheduleArgs>;
    const store = await db
      .select({ timezone: businesses.timezone })
      .from(businesses)
      .where(eq(businesses.id, context.storeId))
      .limit(1);
    const timezone = store[0]?.timezone ?? "Asia/Kolkata";
    return run(async () => {
      const start = DateTime.fromISO(`${input.new_date}T${input.new_time}:00`, { zone: timezone });
      const record = await rescheduleBooking({
        storeId: context.storeId,
        bookingId: input.booking_id,
        customerPhone: context.phone,
        newStartsAt: toISO(start),
      });
      return { ok: true, data: publicBooking(record, await cancellationHours(context.storeId)) };
    });
  }

  if (name === "get_policy") {
    const input = args as z.infer<typeof policyArgs>;
    if (!isPolicyType(input.type)) {
      return fail("invalid_state", "Unknown policy type.");
    }
    const text = await getPolicy(context.storeId, input.type);
    if (!text) {
      return fail("not_found", `No ${input.type} document is stored.`, "Offer to connect the customer with the store.");
    }
    return { ok: true, data: { type: input.type, text } };
  }

  return fail("not_found", `Unknown tool ${name}.`);
}
