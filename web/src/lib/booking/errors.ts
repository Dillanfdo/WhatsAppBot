export const BOOKING_ERROR_CODES = [
  "not_found",
  "store_inactive",
  "service_inactive",
  "invalid_party_size",
  "outside_hours",
  "closed_that_day",
  "too_soon",
  "too_far",
  "slot_unavailable",
  "slot_taken",
  "max_bookings_reached",
  "cancellation_window_passed",
  "not_owner",
  "invalid_state",
  "invalid_phone",
] as const;

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number];

const CONFLICT_CODES = new Set<BookingErrorCode>([
  "store_inactive",
  "service_inactive",
  "slot_unavailable",
  "slot_taken",
  "max_bookings_reached",
  "not_owner",
]);

export class BookingError extends Error {
  readonly hint?: string;

  constructor(
    readonly code: BookingErrorCode,
    message: string,
    hint?: string,
  ) {
    super(message);
    this.name = "BookingError";
    this.hint = hint;
  }
}

export const isBookingError = (error: unknown): error is BookingError =>
  error instanceof BookingError;

export const bookingErrorStatus = (code: BookingErrorCode): number => {
  if (code === "not_found") {
    return 404;
  }
  if (CONFLICT_CODES.has(code)) {
    return 409;
  }
  return 400;
};

export const bookingErrorBody = (error: BookingError) => ({
  error: { code: error.code, message: error.message },
});

export const postgresErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("cause" in error) {
    return postgresErrorCode(error.cause);
  }
  return undefined;
};
