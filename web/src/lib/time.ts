import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export function nowInTimezone(timezone: string = DEFAULT_TIMEZONE): DateTime {
  return DateTime.now().setZone(timezone);
}

export function toISO(dateTime: DateTime): string {
  const iso = dateTime.toISO();
  if (!iso) {
    throw new Error("Could not convert DateTime to ISO string");
  }
  return iso;
}

/** Luxon weekday is 1 = Monday ... 7 = Sunday. Database weekday is 0 = Sunday ... 6 = Saturday. */
export function toDbWeekday(dt: DateTime): number {
  const weekday = dt.weekday;
  if (weekday === 7) {
    return 0;
  }
  if (weekday >= 1 && weekday <= 6) {
    return weekday;
  }
  throw new Error("Cannot map weekday from an invalid DateTime");
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(s: string): { hour: number; minute: number } {
  const match = HHMM.exec(s);
  if (!match) {
    throw new Error(`Expected HH:MM between 00:00 and 23:59, received "${s}"`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** "23 Oct 2026, 2:30 PM" in the given timezone, or an em dash when the input is not a valid date. */
export function formatLocalDateTime(value: string | Date, timezone: string = DEFAULT_TIMEZONE): string {
  const dt = (typeof value === "string" ? DateTime.fromISO(value) : DateTime.fromJSDate(value)).setZone(timezone);
  return dt.isValid ? dt.toFormat("dd LLL yyyy, h:mm a") : "—";
}

/** A closure window as owners think of it: whole days when it spans midnight to midnight, otherwise date and time. */
export function formatClosureRange(startsAt: string, endsAt: string, timezone: string = DEFAULT_TIMEZONE): string {
  const start = DateTime.fromISO(startsAt).setZone(timezone);
  const end = DateTime.fromISO(endsAt).setZone(timezone);
  if (!start.isValid || !end.isValid) {
    return "—";
  }
  const wholeDays = start.equals(start.startOf("day")) && end.equals(end.startOf("day"));
  if (!wholeDays) {
    return `${formatLocalDateTime(startsAt, timezone)} to ${formatLocalDateTime(endsAt, timezone)}`;
  }
  const lastDay = end.minus({ days: 1 });
  return lastDay.hasSame(start, "day")
    ? `${start.toFormat("dd LLL yyyy")} (all day)`
    : `${start.toFormat("dd LLL yyyy")} to ${lastDay.toFormat("dd LLL yyyy")}`;
}

/** Curated, static list so server and browser render identical options. */
export const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;
