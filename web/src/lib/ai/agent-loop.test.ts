import { describe, expect, it } from "vitest";
import { runToolLoop } from "@/lib/ai/agent-loop";
import { claimsMutation, renderConfirmation } from "@/lib/ai/confirm";
import type { LlmChatResponse, LlmClient } from "@/lib/ai/llm/types";

const scripted = (responses: LlmChatResponse[]): LlmClient => {
  const queue = [...responses];
  return {
    provider: "ollama",
    model: "fake",
    chat: async () => {
      const next = queue.shift();
      if (!next) {
        throw new Error("scripted client ran out of responses");
      }
      return next;
    },
  };
};

describe("claimsMutation", () => {
  it("catches booking claims and ignores a normal reply", () => {
    expect(claimsMutation("You're booked for Friday.")).toBe(true);
    expect(claimsMutation("Here are the open times.")).toBe(false);
  });
});

describe("renderConfirmation", () => {
  it("renders the database fields and a short code", () => {
    const text = renderConfirmation(
      "booked",
      {
        id: "abcdef12-0000-4000-8000-000000000099",
        serviceName: "Haircut",
        localLabel: "Fri 23 Oct, 4:00 PM",
        partySize: 1,
        price: "₹500",
        status: "confirmed",
      },
      4,
    );
    expect(text).toContain("Haircut");
    expect(text).toContain("Fri 23 Oct, 4:00 PM");
    expect(text).toContain("Ref abcdef12");
    expect(text).toContain("4 hours");
  });
});

describe("runToolLoop", () => {
  const tools = [{ name: "get_slots", description: "slots", parameters: { type: "object", properties: {} } }];

  it("stops after the tool cap", async () => {
    const llm = scripted(
      Array.from({ length: 8 }, () => ({
        text: "",
        toolCalls: [{ id: "1", name: "get_slots", arguments: { date: "2026-10-23" } }],
      })),
    );
    let calls = 0;
    const result = await runToolLoop({
      llm,
      system: "system",
      messages: [{ role: "user", content: "times" }],
      tools,
      maxCalls: 5,
      contactPhone: "+914430010101",
      execute: async () => {
        calls += 1;
        return { ok: true, data: { slots: [] } };
      },
    });
    expect(calls).toBe(5);
    expect(result.debugError).toBe("tool_cap");
    expect(result.reply).toContain("+914430010101");
  });

  it("returns a tool error and then accepts a recovered call", async () => {
    const llm = scripted([
      { text: "", toolCalls: [{ id: "1", name: "get_slots", arguments: { date: "tomorrow" } }] },
      { text: "", toolCalls: [{ id: "2", name: "get_slots", arguments: { date: "2026-10-23" } }] },
      { text: "Friday at 4:00 PM is open.", toolCalls: [] },
    ]);
    const result = await runToolLoop({
      llm,
      system: "system",
      messages: [{ role: "user", content: "tomorrow" }],
      tools,
      maxCalls: 5,
      contactPhone: null,
      execute: async (_name, args) => {
        if (args.date === "tomorrow") {
          return { ok: false, error: { code: "invalid_state", message: "Use YYYY-MM-DD." } };
        }
        return { ok: true, data: { slots: [{ localTime: "16:00" }] } };
      },
    });
    expect(result.reply).toContain("4:00 PM");
    expect(result.traces.map((trace) => trace.ok)).toEqual([false, true]);
  });

  it("rejects a false booked claim", async () => {
    const llm = scripted([
      { text: "You're booked for Friday.", toolCalls: [] },
      { text: "I have booked it.", toolCalls: [] },
    ]);
    const result = await runToolLoop({
      llm,
      system: "system",
      messages: [{ role: "user", content: "book it" }],
      tools,
      maxCalls: 5,
      contactPhone: "+914430010103",
      execute: async () => ({ ok: true, data: {} }),
    });
    expect(result.debugError).toBe("ungrounded_claim");
    expect(result.reply).toContain("+914430010103");
    expect(result.reply.toLowerCase()).not.toContain("booked");
  });
});
