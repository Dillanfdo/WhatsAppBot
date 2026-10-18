import "server-only";

export type GetAvailableSlotsInput = {
  storeId: string;
  serviceId: string;
  from: Date;
  to: Date;
};

export type TimeSlot = {
  start: Date;
  end: Date;
  resourceId: string;
};

export async function getAvailableSlots(
  input: GetAvailableSlotsInput,
): Promise<TimeSlot[]> {
  void input;
  // TODO: compute free slots from availability rules, exceptions, and bookings.
  // Skip weekdays that are absent from businesses.config.bookable_weekdays.
  return [];
}
