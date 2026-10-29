import { describe, expect, it } from "vitest";
import type { AgentResult } from "@/lib/validation";
import { judgeCase, type EvalCase } from "./judge";

const turn = (reply: string, tools: { name: string; output?: unknown }[] = []): AgentResult => ({
  reply,
  conversationId: "00000000-0000-4000-8000-000000000000",
  model: "test",
  provider: "ollama",
  toolCalls: tools.map((tool) => ({ name: tool.name, input: {}, output: tool.output ?? {}, ok: true, durationMs: 1 })),
});

const base: EvalCase = { id: "x", storeId: "s", phone: "+910000000000", turns: [] };
const none = { count: 0, statuses: [] as string[] };

describe("judgeCase", () => {
  it("passes when required tools ran and no forbidden tool was used", () => {
    const item = { ...base, requireTools: ["get_slots"], forbidTools: ["create_booking"], expectBooking: false };
    expect(judgeCase(item, [turn("Here you go", [{ name: "get_slots" }])], none)).toEqual([]);
  });

  it("reports missing, forbidden and unexpected-booking failures", () => {
    const item = { ...base, requireTools: ["get_slots"], forbidTools: ["create_booking"], expectBooking: false };
    const reasons = judgeCase(item, [turn("Booked!", [{ name: "create_booking" }])], { count: 1, statuses: ["confirmed"] });
    expect(reasons).toEqual(["missing get_slots", "used create_booking", "unexpected booking row"]);
  });

  it("checks final booking statuses regardless of order", () => {
    const item = { ...base, expectStatuses: ["confirmed", "cancelled"] };
    expect(judgeCase(item, [], { count: 2, statuses: ["cancelled", "confirmed"] })).toEqual([]);
    expect(judgeCase(item, [], { count: 1, statuses: ["confirmed"] })).toHaveLength(1);
  });

  it("flags times in a reply that no tool returned", () => {
    const item = { ...base };
    const grounded = turn("Free at 10:30", [{ name: "get_slots", output: { slots: [{ localTime: "10:30" }] } }]);
    expect(judgeCase(item, [grounded], none)).toEqual([]);
    const invented = turn("Free at 11:00", [{ name: "get_slots", output: { slots: [{ localTime: "10:30" }] } }]);
    expect(judgeCase(item, [invented], none)).toEqual(["ungrounded time 11:00"]);
  });

  it("flags forbidden reply text such as a leaked prompt, ignoring case", () => {
    const item = { ...base, forbidReply: ["Rules you must follow"] };
    expect(judgeCase(item, [turn("Sure: RULES YOU MUST FOLLOW are...")], none)).toHaveLength(1);
    expect(judgeCase(item, [turn("I cannot share that.")], none)).toEqual([]);
  });
});
