import { describe, expect, it } from "vitest";
import { modelIsInstalled, parseToolArguments, parseToolCalls } from "@/lib/ai/llm/parse";

describe("parseToolArguments", () => {
  it("accepts an object", () => {
    expect(parseToolArguments({ date: "2026-10-23" })).toEqual({ date: "2026-10-23" });
  });

  it("parses a JSON string", () => {
    expect(parseToolArguments('{"party_size":2}')).toEqual({ party_size: 2 });
  });

  it("rejects a list", () => {
    expect(() => parseToolArguments("[1]")).toThrow(/JSON object/);
  });
});

describe("parseToolCalls", () => {
  it("reads function name and object arguments", () => {
    expect(
      parseToolCalls([
        { id: "call_1", function: { name: "get_slots", arguments: { service_name: "Haircut" } } },
      ]),
    ).toEqual([
      { id: "call_1", name: "get_slots", arguments: { service_name: "Haircut" } },
    ]);
  });

  it("parses string arguments and fills a missing id", () => {
    expect(
      parseToolCalls([{ function: { name: "get_policy", arguments: '{"type":"faq"}' } }]),
    ).toEqual([{ id: "call_0_get_policy", name: "get_policy", arguments: { type: "faq" } }]);
  });
});

describe("modelIsInstalled", () => {
  it("matches the exact tag and :latest", () => {
    expect(modelIsInstalled(["qwen2.5:7b"], "qwen2.5:7b")).toBe(true);
    expect(modelIsInstalled(["llama3.1:latest"], "llama3.1")).toBe(true);
    expect(modelIsInstalled(["llama3.2:latest"], "qwen2.5:7b")).toBe(false);
  });
});
