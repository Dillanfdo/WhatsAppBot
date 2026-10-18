import { describe, expect, it } from "vitest";
import { missingSetupItems, readinessFromFacts, type ReadinessFacts } from "./store-readiness";

const readyFacts = (): ReadinessFacts => ({
  businessHourCount: 1,
  activeResourceCount: 1,
  activeServiceCount: 1,
  documentTypes: ["privacy", "terms", "cancellation"],
});

describe("missingSetupItems", () => {
  it("lists every setup item when the store has none", () => {
    expect(
      missingSetupItems({
        businessHourCount: 0,
        activeResourceCount: 0,
        activeServiceCount: 0,
        documentTypes: [],
      }),
    ).toEqual(["hours", "resource", "service", "privacy", "terms", "cancellation"]);
  });

  it("does not treat unrelated documents as the required ones", () => {
    expect(
      missingSetupItems({
        businessHourCount: 0,
        activeResourceCount: 0,
        activeServiceCount: 0,
        documentTypes: ["faq", "rules"],
      }),
    ).toEqual(["hours", "resource", "service", "privacy", "terms", "cancellation"]);
  });

  it("drops an item once that requirement is met", () => {
    expect(missingSetupItems({ ...readyFacts(), businessHourCount: 0 })).toEqual(["hours"]);
    expect(missingSetupItems({ ...readyFacts(), activeResourceCount: 0 })).toEqual(["resource"]);
    expect(missingSetupItems({ ...readyFacts(), activeServiceCount: 0 })).toEqual(["service"]);
    expect(
      missingSetupItems({
        ...readyFacts(),
        documentTypes: ["terms", "cancellation"],
      }),
    ).toEqual(["privacy"]);
  });

  it("is ready only when hours, a resource, a service, and the three documents exist", () => {
    const facts = readyFacts();
    expect(missingSetupItems(facts)).toEqual([]);
    expect(readinessFromFacts(facts)).toEqual({ ready: true, missing: [] });
  });
});
