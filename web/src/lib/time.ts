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
