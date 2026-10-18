import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEZONE, nowInTimezone, parseHHMM, toDbWeekday } from "./time";

function kolkata(year: number, month: number, day: number): DateTime {
  return DateTime.fromObject({ year, month, day, hour: 12 }, { zone: "Asia/Kolkata" });
}

describe("time", () => {
  it("defaults to Asia/Kolkata", () => {
    expect(DEFAULT_TIMEZONE).toBe("Asia/Kolkata");
    expect(nowInTimezone().zoneName).toBe("Asia/Kolkata");
  });
});

describe("toDbWeekday", () => {
  it("maps Sunday (Luxon 7) to 0", () => {
    const sunday = kolkata(2026, 10, 18);
    expect(sunday.weekday).toBe(7);
    expect(toDbWeekday(sunday)).toBe(0);
  });

  it("maps Monday (Luxon 1) to 1", () => {
    const monday = kolkata(2026, 10, 19);
    expect(monday.weekday).toBe(1);
    expect(toDbWeekday(monday)).toBe(1);
  });

  it("maps Saturday to 6", () => {
    const saturday = kolkata(2026, 10, 17);
    expect(saturday.weekday).toBe(6);
    expect(toDbWeekday(saturday)).toBe(6);
  });

  it("rejects an invalid DateTime", () => {
    expect(() => toDbWeekday(DateTime.invalid("bad"))).toThrow(/invalid DateTime/);
  });
});

describe("parseHHMM", () => {
  it("parses midnight, opening time, and end of day", () => {
    expect(parseHHMM("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseHHMM("10:00")).toEqual({ hour: 10, minute: 0 });
    expect(parseHHMM("23:59")).toEqual({ hour: 23, minute: 59 });
  });

  it("rejects hours, minutes, and shapes outside HH:MM", () => {
    expect(() => parseHHMM("24:00")).toThrow(/HH:MM/);
    expect(() => parseHHMM("10:60")).toThrow(/HH:MM/);
    expect(() => parseHHMM("1:00")).toThrow(/HH:MM/);
    expect(() => parseHHMM("10:00:00")).toThrow(/HH:MM/);
  });
});
