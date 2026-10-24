import { describe, expect, it } from "vitest";
import {
  addWindows,
  assignmentCombinations,
  fitsInWindow,
  generateGrid,
  subtractWindows,
  type ResourceCandidate,
} from "@/lib/booking/availability";
import { toDbWeekday } from "@/lib/time";
import { DateTime } from "luxon";

describe("windows", () => {
  it("subtracts a closure from the middle of a shift", () => {
    expect(subtractWindows([{ startMin: 600, endMin: 1200 }], [{ startMin: 720, endMin: 840 }])).toEqual([
      { startMin: 600, endMin: 720 },
      { startMin: 840, endMin: 1200 },
    ]);
  });

  it("removes a window that is fully closed", () => {
    expect(subtractWindows([{ startMin: 600, endMin: 900 }], [{ startMin: 600, endMin: 900 }])).toEqual([]);
  });

  it("adds special hours and merges overlaps", () => {
    expect(addWindows([{ startMin: 600, endMin: 720 }], [{ startMin: 700, endMin: 900 }])).toEqual([
      { startMin: 600, endMin: 900 },
    ]);
  });
});

describe("generateGrid", () => {
  it("anchors starts at local midnight", () => {
    const grid = generateGrid(15);
    expect(grid[0]).toBe(0);
    expect(grid[1]).toBe(15);
    expect(grid.at(-1)).toBe(23 * 60 + 45);
    expect(grid).toHaveLength((24 * 60) / 15);
  });
});

describe("fitsInWindow", () => {
  it("requires the whole service inside one window", () => {
    const windows = [
      { startMin: 600, endMin: 840 },
      { startMin: 1020, endMin: 1200 },
    ];
    expect(fitsInWindow(windows, 600, 45)).toBe(true);
    expect(fitsInWindow(windows, 800, 45)).toBe(false);
    expect(fitsInWindow(windows, 1020, 120)).toBe(true);
  });
});

describe("assignmentCombinations", () => {
  const table = (id: string, capacity: number): ResourceCandidate => ({
    id,
    type: "table",
    name: id,
    capacity,
  });

  it("picks the smallest fitting resource first", () => {
    const free = new Map([
      [
        "table",
        [table("t4", 4), table("t1", 2), table("t5", 6), table("t3", 4)],
      ],
    ]);
    const [first] = assignmentCombinations(free, [{ resourceType: "table", quantity: 1 }], 10);
    expect(first?.map((resource) => resource.id)).toEqual(["t1"]);
  });

  it("assigns one resource of each required type", () => {
    const free = new Map<string, ResourceCandidate[]>([
      ["staff", [{ id: "s1", type: "staff", name: "Sam", capacity: 1 }]],
      ["chair", [{ id: "c1", type: "chair", name: "Chair", capacity: 1 }]],
    ]);
    const combos = assignmentCombinations(
      free,
      [
        { resourceType: "staff", quantity: 1 },
        { resourceType: "chair", quantity: 1 },
      ],
      10,
    );
    expect(combos).toEqual([
      [
        { id: "s1", type: "staff", name: "Sam", capacity: 1 },
        { id: "c1", type: "chair", name: "Chair", capacity: 1 },
      ],
    ]);
  });
});

describe("toDbWeekday", () => {
  it("keeps Sunday as 0", () => {
    expect(toDbWeekday(DateTime.fromISO("2026-10-18", { zone: "Asia/Kolkata" }))).toBe(0);
  });
});
