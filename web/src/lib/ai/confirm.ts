import { DateTime } from "luxon";
import type { BookingRecord } from "@/lib/booking/bookings";

export type ConfirmationKind = "booked" | "cancelled" | "rescheduled";

const lead: Record<ConfirmationKind, string> = {
  booked: "Booked",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export const renderConfirmation = (
  kind: ConfirmationKind,
  record: Pick<
    BookingRecord,
    "id" | "serviceName" | "localLabel" | "partySize" | "price" | "status"
  >,
  cancellationWindowHours: number,
): string => {
  const when = DateTime.fromISO(record.localLabel, { setZone: true });
  const label = when.isValid ? when.toFormat("ccc d LLL yyyy, h:mm a") : record.localLabel;
  const reminder =
    cancellationWindowHours > 0
      ? `You can cancel up to ${cancellationWindowHours} hours before.`
      : "Contact the store if you need to cancel.";
  return [
    `${lead[kind]}: ${record.serviceName}`,
    label,
    `Party of ${record.partySize}`,
    record.price,
    `Ref ${record.id.slice(0, 8)}`,
    `Status: ${record.status}`,
    reminder,
  ].join("\n");
};

export const claimsMutation = (text: string): boolean =>
  /\b(booked|confirmed|cancelled|canceled|rescheduled)\b/i.test(text);
