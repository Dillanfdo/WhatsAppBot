import { parsePhoneNumberFromString } from "libphonenumber-js";
import { BookingError } from "@/lib/booking/errors";

export const toE164 = (phone: string): string => {
  const parsed = parsePhoneNumberFromString(phone.trim(), "IN");
  if (!parsed?.isValid()) {
    throw new BookingError(
      "invalid_phone",
      "Enter a phone number like +919876543210.",
      "Use a country code, for example +91.",
    );
  }
  return parsed.number;
};
