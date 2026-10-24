export const SAMPLE_NOTICE = "SAMPLE TEXT - replace before going live. Not legal advice.";

export const starterPrivacy = (storeName: string): string =>
  [
    SAMPLE_NOTICE,
    `${storeName} stores your name, phone number, and booking details so the store can manage your appointment.`,
    "Those details are used only for bookings and are not sold. Ask the store if you want a copy or want them removed.",
  ].join("\n\n");

export const starterTerms = (storeName: string): string =>
  [
    SAMPLE_NOTICE,
    `By booking with ${storeName} you agree to arrive on time and to follow the store's cancellation rules.`,
    "The store can refuse a booking that does not match its services, hours, or party size.",
  ].join("\n\n");

export const cancellationFromRules = (hours: number): string =>
  `You can cancel free of charge up to ${hours} hours before your booking. After that window, message or call the store and we will try to free the slot.`;

export const priceListFromServices = (
  rows: { name: string; durationMin: number; priceCents: number | null }[],
): string => {
  const lines = rows.map((service) => {
    const price = service.priceCents === null ? "no charge" : `Rs ${service.priceCents / 100}`;
    return `${service.name}: ${price} (${service.durationMin} min)`;
  });
  return ["Prices are in INR.", ...lines].join("\n");
};
