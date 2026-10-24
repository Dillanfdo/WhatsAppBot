import "server-only";
import { DateTime } from "luxon";
import {
  freeByTypeAt,
  generateGrid,
  requirementsMet,
  type ResourceCandidate,
} from "@/lib/booking/availability";
import {
  assertPartySize,
  dateGate,
  formatLocalLabel,
  hasAnyWindow,
  loadDayContext,
  loadService,
  loadStore,
  type DayContext,
} from "@/lib/booking/context";
import { BookingError } from "@/lib/booking/errors";
import { toISO } from "@/lib/time";

export type GetAvailableSlotsInput = {
  storeId: string;
  serviceId: string;
  date: string;
  partySize: number;
  preferredResourceId?: string;
};

export type AvailableSlot = {
  startsAt: string;
  endsAt: string;
  localTime: string;
  localLabel: string;
  resourceNames?: string[];
};

export type AvailableSlotsResult = {
  slots: AvailableSlot[];
  note?: string;
};

export type StartVerdict =
  | { ok: true; resources: ResourceCandidate[] }
  | { ok: false; code: "too_soon" | "outside_hours" | "slot_unavailable" | "slot_taken"; message: string };

const earliestStart = (context: DayContext): DateTime => {
  const noticeHours = context.store.config.min_notice_hours ?? 0;
  return DateTime.now().setZone(context.store.timezone).plus({ hours: noticeHours });
};

export const judgeStart = (context: DayContext, start: DateTime): StartVerdict => {
  if (!start.isValid) {
    return { ok: false, code: "outside_hours", message: "That time is not on the schedule." };
  }
  if (!start.hasSame(context.day, "day")) {
    return { ok: false, code: "outside_hours", message: "That time is not on the requested day." };
  }
  const startMin = start.hour * 60 + start.minute;
  if (start.second !== 0 || start.millisecond !== 0 || startMin % context.store.slotIntervalMin !== 0) {
    return { ok: false, code: "outside_hours", message: "Choose a time on the booking grid." };
  }
  if (start < earliestStart(context)) {
    return {
      ok: false,
      code: "too_soon",
      message: `Book at least ${context.store.config.min_notice_hours ?? 0} hours ahead.`,
    };
  }
  if (context.resources.length === 0) {
    return { ok: false, code: "slot_unavailable", message: "No resource can take that party." };
  }

  const end = start.plus({ minutes: context.service.durationMin });
  const blockEnd = end.plus({ minutes: context.service.bufferAfterMin });
  const fitting = freeByTypeAt(
    context.resources,
    [],
    context.windows,
    startMin,
    context.service.durationMin,
    start.toMillis(),
    blockEnd.toMillis(),
  );
  if (!requirementsMet(fitting, context.requirements)) {
    return { ok: false, code: "outside_hours", message: "That time is outside opening hours." };
  }
  const free = freeByTypeAt(
    context.resources,
    context.busy,
    context.windows,
    startMin,
    context.service.durationMin,
    start.toMillis(),
    blockEnd.toMillis(),
  );
  if (!requirementsMet(free, context.requirements)) {
    return { ok: false, code: "slot_taken", message: "That time is already booked." };
  }
  const resources = context.requirements.flatMap((requirement) => free.get(requirement.resourceType) ?? []);
  return { ok: true, resources };
};

const slotFromStart = (context: DayContext, start: DateTime): AvailableSlot => {
  const end = start.plus({ minutes: context.service.durationMin });
  const slot: AvailableSlot = {
    startsAt: toISO(start),
    endsAt: toISO(end),
    localTime: start.toFormat("HH:mm"),
    localLabel: formatLocalLabel(start),
  };
  return slot;
};

export async function getAvailableSlots(input: GetAvailableSlotsInput): Promise<AvailableSlotsResult> {
  const store = await loadStore(input.storeId);
  const service = await loadService(input.storeId, input.serviceId);
  assertPartySize(service, input.partySize);
  const day = DateTime.fromISO(input.date, { zone: store.timezone });
  if (!day.isValid) {
    throw new BookingError("invalid_state", "Use a date like 2026-10-23.");
  }
  const context = await loadDayContext({
    store,
    service,
    date: input.date,
    partySize: input.partySize,
    preferredResourceId: input.preferredResourceId,
  });
  const gate = dateGate(store, context.day, context.weekday);
  if (gate) {
    return { slots: [], note: gate.message };
  }
  if (input.preferredResourceId && context.resources.length === 0) {
    return { slots: [], note: "That resource cannot take this booking." };
  }
  if (!hasAnyWindow(context.windows)) {
    return { slots: [], note: "The store is closed that day." };
  }

  const slots: AvailableSlot[] = [];
  let sawTooSoon = false;
  for (const startMin of generateGrid(store.slotIntervalMin)) {
    const start = context.day.startOf("day").plus({ minutes: startMin });
    const verdict = judgeStart(context, start);
    if (!verdict.ok) {
      if (verdict.code === "too_soon") {
        sawTooSoon = true;
      }
      continue;
    }
    const slot = slotFromStart(context, start);
    if (input.preferredResourceId) {
      slot.resourceNames = verdict.resources.map((resource) => resource.name);
    }
    slots.push(slot);
  }
  if (slots.length === 0 && sawTooSoon) {
    return { slots: [], note: `Book at least ${store.config.min_notice_hours ?? 0} hours ahead.` };
  }
  return { slots };
}
