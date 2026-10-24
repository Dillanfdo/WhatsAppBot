import { z } from "zod";

const phone = z.string().trim().refine((value) => value.length === 0 || /^\+[1-9]\d{1,14}$/.test(value), {
  message: "Enter a phone number like +919876543210",
});

export const basicsSchema = z.object({
  name: z.string().trim().min(1, "Enter a store name"),
  timezone: z.string().trim().min(1, "Enter a timezone"),
  contactPhone: phone,
  address: z.string(),
});

export const hoursStepSchema = z.object({
  days: z.array(z.object({ bookable: z.boolean(), shifts: z.array(z.object({ start: z.string(), end: z.string() })) })).length(7),
}).refine((value) => value.days.some((day) => day.bookable && day.shifts.length > 0), {
  message: "Open at least one day",
});

export const resourcesStepSchema = z.object({
  count: z.number().int().min(1, "Add at least one resource"),
});

export const servicesStepSchema = z.object({
  count: z.number().int().min(1, "Add at least one service"),
});

const starter = "SAMPLE TEXT - replace before going live. Not legal advice.";

export const policiesStepSchema = z.object({
  privacy: z.string().trim().min(1, "Privacy text is required").refine((value) => value.startsWith(starter), "Privacy must start with the sample notice"),
  terms: z.string().trim().min(1, "Terms text is required").refine((value) => value.startsWith(starter), "Terms must start with the sample notice"),
  cancellation: z.string().trim().min(1, "Cancellation text is required"),
});

export const stepIssues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues.map((issue) => issue.message) ?? ["Invalid step"]);
