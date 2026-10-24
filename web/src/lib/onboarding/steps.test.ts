import { describe, expect, it } from "vitest";
import { basicsSchema, hoursStepSchema, policiesStepSchema, resourcesStepSchema, servicesStepSchema } from "@/lib/onboarding/steps";

const closedWeek = () =>
  [0, 1, 2, 3, 4, 5, 6].map(() => ({ bookable: false, shifts: [] as { start: string; end: string }[] }));

describe("onboarding steps", () => {
  it("requires a name and a valid phone", () => {
    expect(basicsSchema.safeParse({ name: "", timezone: "Asia/Kolkata", contactPhone: "", address: "" }).success).toBe(false);
    expect(basicsSchema.safeParse({ name: "Glow", timezone: "Asia/Kolkata", contactPhone: "99999", address: "" }).success).toBe(false);
    expect(basicsSchema.safeParse({ name: "Glow", timezone: "Asia/Kolkata", contactPhone: "+919876543210", address: "" }).success).toBe(true);
  });

  it("requires one open day", () => {
    const days = closedWeek();
    expect(hoursStepSchema.safeParse({ days }).success).toBe(false);
    days[1] = { bookable: true, shifts: [{ start: "10:00", end: "18:00" }] };
    expect(hoursStepSchema.safeParse({ days }).success).toBe(true);
  });

  it("requires a resource and a service", () => {
    expect(resourcesStepSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(servicesStepSchema.safeParse({ count: 1 }).success).toBe(true);
  });

  it("requires sample-prefixed privacy and terms", () => {
    const notice = "SAMPLE TEXT - replace before going live. Not legal advice.";
    expect(policiesStepSchema.safeParse({ privacy: "hello", terms: notice, cancellation: "24h" }).success).toBe(false);
    expect(policiesStepSchema.safeParse({ privacy: notice, terms: notice, cancellation: "24h" }).success).toBe(true);
  });
});
