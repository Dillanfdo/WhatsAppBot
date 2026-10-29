import { describe, expect, it } from "vitest";
import { loadStepIssues } from "@/lib/onboarding/step-gate";

const respondWith = (routes: Record<string, unknown>) => async (url: string) => {
  const key = Object.keys(routes).find((route) => url.endsWith(route));
  return key === undefined
    ? new Response("{}", { status: 404 })
    : new Response(JSON.stringify(routes[key]), { status: 200 });
};

const openWeek = { hours: { days: Array.from({ length: 7 }, (_, index) => ({ bookable: index === 1, shifts: index === 1 ? [{ start: "10:00", end: "18:00" }] : [] })) } };

describe("loadStepIssues", () => {
  it("blocks the hours step until a day is open", async () => {
    const closed = { hours: { days: Array.from({ length: 7 }, () => ({ bookable: false, shifts: [] })) } };
    expect(await loadStepIssues("s", 2, respondWith({ "/hours": closed }))).toEqual(["Open at least one day"]);
    expect(await loadStepIssues("s", 2, respondWith({ "/hours": openWeek }))).toEqual([]);
  });

  it("ignores inactive resources", async () => {
    const fetcher = respondWith({ "/resources": { resources: [{ type: "staff", isActive: false }] } });
    expect(await loadStepIssues("s", 3, fetcher)).toHaveLength(1);
  });

  it("flags services whose required resource type has no active resource", async () => {
    const fetcher = respondWith({
      "/services": { services: [{ name: "Checkup", isActive: true, requirements: [{ resourceType: "staff" }, { resourceType: "chair" }] }] },
      "/resources": { resources: [{ type: "staff", isActive: true }] },
    });
    const issues = await loadStepIssues("s", 4, fetcher);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("chair");
  });

  it("flags missing booking rules and missing policies", async () => {
    expect((await loadStepIssues("s", 5, respondWith({ "/s": { store: { config: {} } } }))).length).toBeGreaterThan(0);
    const docs = { "/documents": { documents: [{ type: "privacy", content: "p" }] } };
    expect((await loadStepIssues("s", 6, respondWith(docs))).length).toBe(2);
  });

  it("passes the review step and reports request failures", async () => {
    expect(await loadStepIssues("s", 7, respondWith({}))).toEqual([]);
    expect(await loadStepIssues("s", 3, respondWith({}))).toEqual(["Could not check this step. Please try again."]);
  });
});
