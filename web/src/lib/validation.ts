import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@/lib/time";

export const chatRequestSchema = z.object({
  storeId: z.string().min(1),
  phone: z.string().min(1),
  message: z.string().min(1),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const agentToolTraceSchema = z.object({
  name: z.string(),
  input: z.unknown(),
  output: z.unknown(),
});

export const agentResultSchema = z.object({
  reply: z.string(),
  toolCalls: z.array(agentToolTraceSchema),
});

export type AgentToolTrace = z.infer<typeof agentToolTraceSchema>;
export type AgentResult = z.infer<typeof agentResultSchema>;

export const storeSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  timezone: z.string(),
  isActive: z.boolean(),
});

export const storeListResponseSchema = z.object({
  stores: z.array(storeSummarySchema),
});

export type StoreSummary = z.infer<typeof storeSummarySchema>;
export type StoreListResponse = z.infer<typeof storeListResponseSchema>;

export const businessConfigSchema = z.object({
  tone: z.string().optional(),
  languages: z.array(z.string()).optional(),
  cancellation_window_hours: z.number().optional(),
  min_notice_hours: z.number().optional(),
  max_days_ahead: z.number().optional(),
  auto_confirm: z.boolean().optional(),
  max_active_bookings_per_customer: z.number().optional(),
  bookable_weekdays: z.array(z.number().int().min(0).max(6)).optional(),
});

export const storeDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  mapUrl: z.string().nullable(),
  timezone: z.string(),
  slotIntervalMin: z.number(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  ownerWhatsapp: z.string().nullable(),
  isActive: z.boolean(),
  config: businessConfigSchema,
  resourceCount: z.coerce.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StoreDetails = z.infer<typeof storeDetailsSchema>;

export const STORE_TONE_OPTIONS = ["friendly", "warm and polite", "casual and fun"] as const;

export const STORE_LANGUAGE_OPTIONS = ["English", "Tamil", "Hindi"] as const;

export const slotIntervalUnitSchema = z.enum(["min", "hours"]);

const E164 = /^\+[1-9]\d{1,14}$/;

const blankOr = (check: (value: string) => boolean, message: string) =>
  z.string().trim().refine((value) => value.length === 0 || check(value), { message });

const nonNegativeInt = z.number().int().min(0);

const isIanaTimezone = (value: string): boolean => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const storeTypeSchema = z.enum(["salon", "restaurant", "game_centre"]);

export const resourceTypeSchema = z.enum(["staff", "table", "room", "console", "chair"]);

export const storeResourceSchema = z.object({
  id: z.uuid(),
  type: resourceTypeSchema,
  name: z.string(),
  capacity: z.number().int().min(1),
  isActive: z.boolean(),
});

export type StoreResource = z.infer<typeof storeResourceSchema>;

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .refine(isIanaTimezone, "Enter a valid timezone");

export const updateStoreSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: storeTypeSchema.optional(),
  timezone: ianaTimezoneSchema.optional(),
  description: z.string().trim(),
  address: z.string().trim(),
  mapUrl: blankOr((value) => URL.canParse(value), "Enter a valid URL"),
  contactPhone: blankOr((value) => E164.test(value), "Enter a phone number like +919876543210"),
  contactEmail: blankOr(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email",
  ),
  ownerWhatsapp: blankOr(
    (value) => E164.test(value),
    "Enter a WhatsApp number like +919876543210",
  ),
  slotAmount: z.number().int().min(1),
  slotUnit: slotIntervalUnitSchema,
  tone: z.string().trim().min(1),
  languages: z.array(z.string().trim().min(1)),
  cancellationWindowHours: nonNegativeInt,
  minNoticeHours: nonNegativeInt,
  maxDaysAhead: nonNegativeInt,
  autoConfirm: z.boolean(),
  maxActiveBookingsPerCustomer: nonNegativeInt,
});

export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

export const createStoreSchema = z.object({
  name: z.string().trim().min(1),
  type: storeTypeSchema,
  timezone: ianaTimezoneSchema.default(DEFAULT_TIMEZONE),
  description: z.string().trim().default(""),
  address: z.string().trim().default(""),
  mapUrl: blankOr((value) => URL.canParse(value), "Enter a valid URL").default(""),
  contactPhone: blankOr(
    (value) => E164.test(value),
    "Enter a phone number like +919876543210",
  ).default(""),
  contactEmail: blankOr(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Enter a valid email",
  ).default(""),
  ownerWhatsapp: blankOr(
    (value) => E164.test(value),
    "Enter a WhatsApp number like +919876543210",
  ).default(""),
  tone: z.string().trim().min(1).default("friendly"),
  languages: z.array(z.string().trim().min(1)).default(["English"]),
  cancellationWindowHours: nonNegativeInt.default(0),
  minNoticeHours: nonNegativeInt.default(0),
  maxDaysAhead: nonNegativeInt.default(0),
  autoConfirm: z.boolean().default(false),
  maxActiveBookingsPerCustomer: nonNegativeInt.default(0),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const STORE_HOURS_WEEKDAYS = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
] as const;

const storeShiftSchema = z
  .object({
    start: z.string().regex(HHMM, "Use a time like 10:00"),
    end: z.string().regex(HHMM, "Use a time like 18:00"),
  })
  .superRefine((shift, ctx) => {
    if (shift.end <= shift.start) {
      ctx.addIssue({
        code: "custom",
        message: "Closing time must be after opening time",
        path: ["end"],
      });
    }
  });

const storeHoursDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    bookable: z.boolean(),
    shifts: z.array(storeShiftSchema),
  })
  .superRefine((day, ctx) => {
    if (day.bookable && day.shifts.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add opening hours before allowing bookings",
        path: ["bookable"],
      });
    }

    const sorted = day.shifts
      .map((shift, index) => ({ ...shift, index }))
      .filter((shift) => HHMM.test(shift.start) && HHMM.test(shift.end) && shift.end > shift.start)
      .sort((left, right) => left.start.localeCompare(right.start));

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous && current && current.start < previous.end) {
        ctx.addIssue({
          code: "custom",
          message: "Shifts on the same day must not overlap",
          path: ["shifts", current.index, "start"],
        });
      }
    }
  });

export const updateStoreHoursSchema = z
  .object({
    days: z.array(storeHoursDaySchema).length(7),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<number>();
    input.days.forEach((day, index) => {
      if (seen.has(day.weekday)) {
        ctx.addIssue({
          code: "custom",
          message: "Include each weekday once",
          path: ["days", index, "weekday"],
        });
      }
      seen.add(day.weekday);
    });
  });

export type UpdateStoreHoursInput = z.infer<typeof updateStoreHoursSchema>;

export const bookingFilterSchema = z.object({
  // TODO: date range, store, status filters
  storeId: z.string().min(1).optional(),
});

export type BookingFilter = z.infer<typeof bookingFilterSchema>;
