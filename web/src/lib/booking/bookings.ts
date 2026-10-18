import "server-only";

export type CreateBookingInput = {
  storeId: string;
  customerPhone: string;
  serviceId: string;
  start: Date;
  resourceId?: string;
};

export type CancelBookingInput = {
  storeId: string;
  customerPhone: string;
  bookingId: string;
};

export type ListBookingsInput = {
  storeId: string;
  customerPhone?: string;
};

export type BookingRecord = {
  id: string;
  storeId: string;
  start: Date;
  end: Date;
  status: "confirmed" | "cancelled";
};

export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingRecord> {
  void input;
  // TODO: persist a booking after slot validation
  throw new Error("TODO: implement createBooking");
}

export async function cancelBooking(input: CancelBookingInput): Promise<void> {
  void input;
  // TODO: cancel a booking owned by this customer
  throw new Error("TODO: implement cancelBooking");
}

export async function listBookings(
  input: ListBookingsInput,
): Promise<BookingRecord[]> {
  void input;
  // TODO: list bookings for a store (and optional customer)
  return [];
}
