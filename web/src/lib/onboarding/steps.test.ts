import { describe, expect, it } from "vitest";
import { clampStep } from "@/lib/onboarding/wizard-steps";
import {
  basicsFieldErrors,
  basicsSchema,
  hoursStepSchema,
  policiesStepSchema,
  resourcesStepSchema,
  rulesStepSchema,
  servicesStepSchema,
} from "@/lib/onboarding/steps";

const closedWeek = () =>
  [0, 1, 2, 3, 4, 5, 6].map(() => ({ bookable: false, shifts: [] as { start: string; end: string }[] }));

const validBasics = {
  name: "Glow",
  timezone: "Asia/Kolkata",
  description: "",
  address: "12 Anna Salai, Chennai",
  mapUrl: "",
  contactPhone: "+919876543210",
  contactEmail: "",
  ownerWhatsapp: "+919876543211",
  languages: ["English"],
  tone: "friendly",
};

describe("basics step", () => {
  it("accepts a complete form", () => {
    expect(basicsSchema.safeParse(validBasics).success).toBe(true);
  });

  it("requires name, address, contact phone and owner WhatsApp", () => {
    const errors = basicsFieldErrors({ ...validBasics, name: "", address: "", contactPhone: "", ownerWhatsapp: "" });
    expect(Object.keys(errors).sort()).toEqual(["address", "contactPhone", "name", "ownerWhatsapp"]);
  });

  it("rejects malformed phone, email, URL and timezone", () => {
    const errors = basicsFieldErrors({
      ...validBasics,
      contactPhone: "99999",
      contactEmail: "nope",
      mapUrl: "not a url",
      timezone: "Mars/Base",
    });
    expect(Object.keys(errors).sort()).toEqual(["contactEmail", "contactPhone", "mapUrl", "timezone"]);
  });

  it("requires at least one language", () => {
    expect(basicsFieldErrors({ ...validBasics, languages: [] }).languages).toBeDefined();
  });
});

describe("later steps", () => {
  it("requires one open day with shifts", () => {
    const days = closedWeek();
    expect(hoursStepSchema.safeParse({ days }).success).toBe(false);
    days[1] = { bookable: true, shifts: [{ start: "10:00", end: "18:00" }] };
    expect(hoursStepSchema.safeParse({ days }).success).toBe(true);
  });

  it("requires a resource and a service", () => {
    expect(resourcesStepSchema.safeParse({ count: 0 }).success).toBe(false);
    expect(servicesStepSchema.safeParse({ count: 1 }).success).toBe(true);
  });

  it("requires every booking rule to be set", () => {
    const rules = { maxDaysAhead: 30, minNoticeHours: 2, cancellationWindowHours: 4, autoConfirm: true };
    expect(rulesStepSchema.safeParse(rules).success).toBe(true);
    expect(rulesStepSchema.safeParse({ ...rules, maxDaysAhead: 0 }).success).toBe(false);
    expect(rulesStepSchema.safeParse({ ...rules, autoConfirm: undefined }).success).toBe(false);
    expect(rulesStepSchema.safeParse({}).success).toBe(false);
  });

  it("requires privacy, terms and cancellation text, but not the sample notice", () => {
    expect(policiesStepSchema.safeParse({ privacy: "", terms: "t", cancellation: "c" }).success).toBe(false);
    expect(policiesStepSchema.safeParse({ privacy: "Our own policy", terms: "Our terms", cancellation: "24h" }).success).toBe(true);
  });
});

describe("clampStep", () => {
  it("keeps resumed steps between 2 and 7 and tolerates junk", () => {
    expect(clampStep(0)).toBe(2);
    expect(clampStep(5)).toBe(5);
    expect(clampStep(99)).toBe(7);
    expect(clampStep(Number.NaN)).toBe(2);
  });
});
