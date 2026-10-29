import { z } from "zod";
import { ianaTimezoneSchema, STORE_TONE_OPTIONS } from "@/lib/validation";

const E164 = /^\+[1-9]\d{1,14}$/;

const requiredPhone = (what: string) =>
  z.string().trim().min(1, `Enter ${what}`).regex(E164, "Enter a number like +919876543210");

const blankOr = (check: (value: string) => boolean, message: string) =>
  z.string().trim().refine((value) => value.length === 0 || check(value), { message });

export const basicsSchema = z.object({
  name: z.string().trim().min(1, "Enter a store name"),
  timezone: ianaTimezoneSchema,
  description: z.string().trim(),
  address: z.string().trim().min(1, "Enter the store address"),
  mapUrl: blankOr((value) => URL.canParse(value), "Enter a valid URL"),
  contactPhone: requiredPhone("a contact phone number"),
  contactEmail: blankOr((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email"),
  ownerWhatsapp: requiredPhone("the owner's WhatsApp number"),
  languages: z.array(z.string().trim().min(1)).min(1, "Pick at least one language"),
  tone: z.string().trim().min(1).default(STORE_TONE_OPTIONS[0]),
});

export type BasicsInput = z.infer<typeof basicsSchema>;

/** First message per field, so a form can show one error under each input. */
export const basicsFieldErrors = (input: unknown): Partial<Record<keyof BasicsInput, string>> => {
  const result = basicsSchema.safeParse(input);
  if (result.success) {
    return {};
  }
  const errors: Partial<Record<keyof BasicsInput, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as keyof BasicsInput] = issue.message;
    }
  }
  return errors;
};

export const hoursStepSchema = z
  .object({
    days: z
      .array(z.object({ bookable: z.boolean(), shifts: z.array(z.object({ start: z.string(), end: z.string() })) }))
      .length(7),
  })
  .refine((value) => value.days.some((day) => day.bookable && day.shifts.length > 0), {
    message: "Open at least one day",
  });

export const resourcesStepSchema = z.object({
  count: z.number().int().min(1, "Add at least one active resource"),
});

export const servicesStepSchema = z.object({
  count: z.number().int().min(1, "Add at least one active service"),
});

export const rulesStepSchema = z.object({
  maxDaysAhead: z
    .number({ error: "Set how many days ahead customers can book" })
    .int()
    .min(1, "Set how many days ahead customers can book"),
  minNoticeHours: z.number({ error: "Set the minimum notice" }).int().min(0),
  cancellationWindowHours: z.number({ error: "Set the cancellation window" }).int().min(0),
  autoConfirm: z.boolean({ error: "Choose whether bookings are confirmed automatically" }),
});

export const policiesStepSchema = z.object({
  privacy: z.string().trim().min(1, "Save a Privacy Policy"),
  terms: z.string().trim().min(1, "Save the Terms and Conditions"),
  cancellation: z.string().trim().min(1, "Save a cancellation policy"),
});

export const stepIssues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? ["Invalid step"]);
