import { describe, expect, it } from "vitest";
import { draftToPayload, emptyServiceDraft, partySizeWarnings } from "@/lib/service-draft";

const table = (id: string, capacity: number, isActive = true) => ({ id, type: "table" as const, capacity, isActive });

describe("draftToPayload", () => {
  it("converts rupees to cents and builds question keys", () => {
    const draft = {
      ...emptyServiceDraft("table"),
      name: "Two hours",
      rupees: "700.50",
      intakeQuestions: [{ label: "Is it a birthday?", required: false }],
    };
    const result = draftToPayload(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.priceCents).toBe(70050);
      expect(result.payload.intakeQuestions?.[0]?.key).toBe("is_it_a_birthday");
    }
  });

  it("treats a blank price as no price and rejects a bad one", () => {
    expect(draftToPayload({ ...emptyServiceDraft(), name: "Haircut" })).toMatchObject({ ok: true });
    expect(draftToPayload({ ...emptyServiceDraft(), name: "Haircut", rupees: "abc" })).toMatchObject({ ok: false });
  });

  it("rejects max party below min party and duplicate resource types", () => {
    expect(draftToPayload({ ...emptyServiceDraft(), name: "A", minParty: 3, maxParty: 2 })).toMatchObject({ ok: false });
    const duplicate = {
      ...emptyServiceDraft(),
      name: "A",
      requirements: [
        { resourceType: "staff" as const, quantity: 1 },
        { resourceType: "staff" as const, quantity: 1 },
      ],
    };
    expect(draftToPayload(duplicate)).toMatchObject({ ok: false });
  });

  it("requires at least one resource type and a name", () => {
    expect(draftToPayload({ ...emptyServiceDraft(), name: "A", requirements: [] })).toMatchObject({ ok: false });
    expect(draftToPayload({ ...emptyServiceDraft(), name: "  " })).toMatchObject({ ok: false });
  });
});

describe("partySizeWarnings", () => {
  const base = { ...emptyServiceDraft("table"), maxParty: 6 };

  it("warns when no table can seat the party", () => {
    expect(partySizeWarnings(base, [table("a", 4), table("b", 4)])).toHaveLength(1);
    expect(partySizeWarnings(base, [table("a", 4), table("b", 8)])).toHaveLength(0);
  });

  it("only counts active resources and respects restrictions", () => {
    expect(partySizeWarnings(base, [table("a", 8, false)])).toHaveLength(1);
    expect(partySizeWarnings({ ...base, resourceIds: ["a"] }, [table("a", 4), table("b", 8)])).toHaveLength(1);
  });

  it("warns when there is no resource of a required type", () => {
    const draft = {
      ...emptyServiceDraft("staff"),
      requirements: [
        { resourceType: "staff" as const, quantity: 1 },
        { resourceType: "chair" as const, quantity: 1 },
      ],
    };
    const warnings = partySizeWarnings(draft, [{ id: "s", type: "staff", capacity: 1, isActive: true }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("chair");
  });
});
