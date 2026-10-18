import type { BusinessConfig, IntakeQuestion } from "../lib/db/schema";

/**
 * Effective hours of a resource = its own availability rules if it has any,
 * otherwise the business-wide rules (resource_id null).
 * Priya has no rules of her own, so she follows Glow Salon's hours.
 * Arjun has split-shift rules, so those hours apply to him instead.
 *
 * availability_rules.weekday uses 0 = Sunday ... 6 = Saturday.
 */

export const SEED_TIMEZONE = "Asia/Kolkata";
export const SEED_CURRENCY = "INR";
export const SEED_SLOT_INTERVAL_MIN = 15;

const SAMPLE_NOTICE = "SAMPLE TEXT - replace before going live. Not legal advice.";

export const SEED_IDS = {
  salon: "00000000-0000-4000-8000-000000000001",
  restaurant: "00000000-0000-4000-8000-000000000002",
  gameCentre: "00000000-0000-4000-8000-000000000003",
  resources: {
    salon: {
      priya: "00000000-0000-4000-8000-000000000011",
      arjun: "00000000-0000-4000-8000-000000000012",
    },
    restaurant: {
      t1: "00000000-0000-4000-8000-000000000021",
      t2: "00000000-0000-4000-8000-000000000022",
      t3: "00000000-0000-4000-8000-000000000023",
      t4: "00000000-0000-4000-8000-000000000024",
      t5: "00000000-0000-4000-8000-000000000025",
    },
    gameCentre: {
      table1: "00000000-0000-4000-8000-000000000031",
      table2: "00000000-0000-4000-8000-000000000032",
      table3: "00000000-0000-4000-8000-000000000033",
      table4: "00000000-0000-4000-8000-000000000034",
    },
  },
  services: {
    salon: {
      haircut: "00000000-0000-4000-8000-000000000041",
      beardTrim: "00000000-0000-4000-8000-000000000042",
      hairColour: "00000000-0000-4000-8000-000000000043",
    },
    restaurant: {
      tableReservation: "00000000-0000-4000-8000-000000000051",
    },
    gameCentre: {
      oneHour: "00000000-0000-4000-8000-000000000061",
      twoHours: "00000000-0000-4000-8000-000000000062",
      threeHours: "00000000-0000-4000-8000-000000000063",
    },
  },
} as const;

export const seededBusinessIds = [
  SEED_IDS.salon,
  SEED_IDS.restaurant,
  SEED_IDS.gameCentre,
] as const;

/** 0 = Sunday ... 6 = Saturday. */
export const WEEKDAY = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

const MON_SAT = [
  WEEKDAY.monday,
  WEEKDAY.tuesday,
  WEEKDAY.wednesday,
  WEEKDAY.thursday,
  WEEKDAY.friday,
  WEEKDAY.saturday,
];

const MON_FRI = [
  WEEKDAY.monday,
  WEEKDAY.tuesday,
  WEEKDAY.wednesday,
  WEEKDAY.thursday,
  WEEKDAY.friday,
];

const ALL_DAYS = [
  WEEKDAY.sunday,
  WEEKDAY.monday,
  WEEKDAY.tuesday,
  WEEKDAY.wednesday,
  WEEKDAY.thursday,
  WEEKDAY.friday,
  WEEKDAY.saturday,
];

export type ResourceType = "staff" | "table" | "room" | "console" | "chair";

export type SeedResource = {
  id: string;
  type: ResourceType;
  name: string;
  capacity: number;
};

export type SeedRequirement = {
  resourceType: ResourceType;
  quantity: number;
};

export type SeedService = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  bufferAfterMin: number;
  priceCents: number | null;
  minParty: number;
  maxParty: number;
  intakeQuestions: IntakeQuestion[];
  requirements: SeedRequirement[];
  /** When set, only these resources may deliver the service. */
  resourceIds?: string[];
};

export type SeedRule = {
  resourceId: string | null;
  weekdays: number[];
  start: string;
  end: string;
};

export type SeedException =
  | {
      resourceId: string | null;
      daysFromNow: number;
      reason: string;
      kind: "full_day";
    }
  | {
      resourceId: string | null;
      daysFromNow: number;
      reason: string;
      kind: "window";
      start: string;
      end: string;
    };

export type DocumentType =
  | "privacy"
  | "terms"
  | "cancellation"
  | "no_show"
  | "faq"
  | "rules"
  | "price_list";

export type SeedDocument = {
  type: DocumentType;
  title: string;
  content: string;
};

type SeedBusinessConfig = Required<Omit<BusinessConfig, "bookable_weekdays">>;

export type SeedStore = {
  id: string;
  name: string;
  type: string;
  description: string;
  address: string;
  contactPhone: string;
  ownerWhatsapp: string;
  config: SeedBusinessConfig;
  resources: SeedResource[];
  services: SeedService[];
  rules: SeedRule[];
  exceptions: SeedException[];
  documents: SeedDocument[];
};

export type SampleCustomer = {
  phone: string;
  name: string;
};

export type SampleBooking = {
  businessId: string;
  serviceId: string;
  resourceId: string;
  customerPhone: string;
  start: string;
  partySize: number;
  idempotencyKey: string;
};

/** Rs 500 = 50000 price cents. */
function rupees(amount: number): number {
  return amount * 100;
}

function priceList(services: readonly SeedService[]): string {
  const lines = services.map((service) => {
    const price = service.priceCents === null ? "no charge" : `Rs ${service.priceCents / 100}`;
    return `${service.name}: ${price} (${service.durationMin} min)`;
  });
  return ["Prices are in INR.", ...lines].join("\n");
}

function cancellationPolicy(hours: number): string {
  return `You can cancel free of charge up to ${hours} hours before your booking. After that window, message or call the store and we will try to free the slot.`;
}

function noShowPolicy(storeName: string): string {
  return `If you miss your booking, ${storeName} marks it as a no-show. There is no no-show fee. Please cancel ahead of time so someone else can take the slot.`;
}

const haircutQuestions: IntakeQuestion[] = [
  { key: "allergies", label: "Any allergies we should know about?", required: false },
];

const reservationQuestions: IntakeQuestion[] = [
  { key: "occasion", label: "Is this for a special occasion?", required: false },
];

const gameQuestions: IntakeQuestion[] = [
  { key: "birthday", label: "Is this a birthday celebration?", required: false },
  { key: "games", label: "Any games you want us to set up?", required: false },
];

const salonConfig = {
  tone: "friendly",
  languages: ["English", "Tamil", "Hindi"],
  cancellation_window_hours: 4,
  min_notice_hours: 2,
  max_days_ahead: 30,
  auto_confirm: true,
  max_active_bookings_per_customer: 3,
} satisfies SeedBusinessConfig;

const salonServices: SeedService[] = [
  {
    id: SEED_IDS.services.salon.haircut,
    name: "Haircut",
    description: "Wash and cut with Priya or Arjun.",
    durationMin: 45,
    bufferAfterMin: 5,
    priceCents: rupees(500),
    minParty: 1,
    maxParty: 1,
    intakeQuestions: haircutQuestions,
    requirements: [{ resourceType: "staff", quantity: 1 }],
  },
  {
    id: SEED_IDS.services.salon.beardTrim,
    name: "Beard trim",
    description: "Scissor and trimmer beard shape with Priya or Arjun.",
    durationMin: 20,
    bufferAfterMin: 5,
    priceCents: rupees(200),
    minParty: 1,
    maxParty: 1,
    intakeQuestions: [],
    requirements: [{ resourceType: "staff", quantity: 1 }],
  },
  {
    id: SEED_IDS.services.salon.hairColour,
    name: "Hair colour",
    description: "Full colour appointment with Priya.",
    durationMin: 120,
    bufferAfterMin: 10,
    priceCents: rupees(2500),
    minParty: 1,
    maxParty: 1,
    intakeQuestions: [],
    requirements: [{ resourceType: "staff", quantity: 1 }],
    resourceIds: [SEED_IDS.resources.salon.priya],
  },
];

const salonDocuments: SeedDocument[] = [
  {
    type: "privacy",
    title: "Privacy policy",
    content: [
      SAMPLE_NOTICE,
      "Glow Salon stores your name, WhatsApp number, and booking notes so we can confirm your visit and reach you if a stylist is running late.",
      "We keep that information for the store's booking records and do not sell it. Ask us if you want a copy or want it removed.",
    ].join("\n\n"),
  },
  {
    type: "terms",
    title: "Terms of service",
    content: [
      SAMPLE_NOTICE,
      "A booking at Glow Salon holds one stylist for the service you chose. Please book a separate appointment for each person.",
      "Hair colour is done by Priya. Arriving late may shorten the service so the next guest is not kept waiting.",
    ].join("\n\n"),
  },
  {
    type: "cancellation",
    title: "Cancellation policy",
    content: cancellationPolicy(salonConfig.cancellation_window_hours),
  },
  {
    type: "no_show",
    title: "No-show policy",
    content: noShowPolicy("Glow Salon"),
  },
  {
    type: "faq",
    title: "Frequently asked questions",
    content: [
      "Q: Is there parking?",
      "A: There is paid street parking on Cathedral Road and a small lot behind the building.",
      "",
      "Q: What payment methods do you accept?",
      "A: UPI, debit and credit cards, and cash.",
      "",
      "Q: What should I bring?",
      "A: Nothing for a haircut or beard trim. For colour, come with dry hair and tell us about any allergies.",
      "",
      "Q: Do you serve food and drinks?",
      "A: We offer water. Please leave outside food and drinks outside the salon.",
      "",
      "Q: How large a group can I book?",
      "A: Each appointment is for one person. Book a separate slot for every guest.",
      "",
      "Q: How do I reschedule?",
      `A: Message us on WhatsApp. You can cancel free of charge up to ${salonConfig.cancellation_window_hours} hours before your booking, then choose a new time.`,
    ].join("\n"),
  },
  {
    type: "rules",
    title: "House rules",
    content: [
      "Please arrive a few minutes early.",
      "One guest per stylist. Friends can wait in the seating area.",
      "Tell us about allergies before a colour service.",
      "Keep phones on silent during the appointment.",
    ].join("\n"),
  },
  {
    type: "price_list",
    title: "Price list",
    content: priceList(salonServices),
  },
];

const restaurantConfig = {
  tone: "warm and polite",
  languages: ["English", "Tamil"],
  cancellation_window_hours: 2,
  min_notice_hours: 1,
  max_days_ahead: 14,
  auto_confirm: true,
  max_active_bookings_per_customer: 2,
} satisfies SeedBusinessConfig;

const restaurantServices: SeedService[] = [
  {
    id: SEED_IDS.services.restaurant.tableReservation,
    name: "Table reservation",
    description: "A table for lunch or dinner.",
    durationMin: 90,
    bufferAfterMin: 15,
    priceCents: null,
    minParty: 1,
    maxParty: 6,
    intakeQuestions: reservationQuestions,
    requirements: [{ resourceType: "table", quantity: 1 }],
  },
];

const restaurantDocuments: SeedDocument[] = [
  {
    type: "privacy",
    title: "Privacy policy",
    content: [
      SAMPLE_NOTICE,
      "Spice Route stores your name, WhatsApp number, party size, and any occasion note so we can hold the right table.",
      "We use those details only for the reservation and do not sell them. Ask the restaurant if you want them deleted.",
    ].join("\n\n"),
  },
  {
    type: "terms",
    title: "Terms of service",
    content: [
      SAMPLE_NOTICE,
      "A table reservation at Spice Route holds one table for 90 minutes. The reservation itself has no fee; you pay for what you order.",
      "Large celebrations above six guests need a phone call so we can plan the dining room.",
    ].join("\n\n"),
  },
  {
    type: "cancellation",
    title: "Cancellation policy",
    content: cancellationPolicy(restaurantConfig.cancellation_window_hours),
  },
  {
    type: "no_show",
    title: "No-show policy",
    content: noShowPolicy("Spice Route"),
  },
  {
    type: "faq",
    title: "Frequently asked questions",
    content: [
      "Q: Is there parking?",
      "A: We do not have a private lot. Paid parking in T. Nagar is a short walk away.",
      "",
      "Q: What payment methods do you accept?",
      "A: UPI, cards, and cash. Holding the table is free.",
      "",
      "Q: What should I bring?",
      "A: Just your party. Ask us if you need a high chair.",
      "",
      "Q: Can we bring food and drinks?",
      "A: Please order from the menu. Outside food and drinks are not allowed.",
      "",
      "Q: How large a group can I book?",
      "A: One reservation seats 1 to 6 people. Call the restaurant for a larger group.",
      "",
      "Q: How do I reschedule?",
      `A: Message us on WhatsApp at least ${restaurantConfig.cancellation_window_hours} hours before the reservation and we will move it to a new time.`,
    ].join("\n"),
  },
  {
    type: "rules",
    title: "House rules",
    content: [
      `Please arrive on time. We hold the table for ${restaurantServices[0].bufferAfterMin} minutes after your reservation time.`,
      "Outside food and drinks are not allowed.",
      "One reservation covers one table.",
      "Smart casual clothing is welcome.",
    ].join("\n"),
  },
  {
    type: "price_list",
    title: "Price list",
    content: priceList(restaurantServices),
  },
];

const gameConfig = {
  tone: "casual and fun",
  languages: ["English", "Tamil", "Hindi"],
  cancellation_window_hours: 12,
  min_notice_hours: 2,
  max_days_ahead: 21,
  auto_confirm: true,
  max_active_bookings_per_customer: 3,
} satisfies SeedBusinessConfig;

const gameServices: SeedService[] = [
  {
    id: SEED_IDS.services.gameCentre.oneHour,
    name: "Table booking - 1 hour",
    description: "A table and games for one hour.",
    durationMin: 60,
    bufferAfterMin: 10,
    priceCents: rupees(400),
    minParty: 1,
    maxParty: 8,
    intakeQuestions: gameQuestions,
    requirements: [{ resourceType: "table", quantity: 1 }],
  },
  {
    id: SEED_IDS.services.gameCentre.twoHours,
    name: "Table booking - 2 hours",
    description: "A table and games for two hours.",
    durationMin: 120,
    bufferAfterMin: 10,
    priceCents: rupees(700),
    minParty: 1,
    maxParty: 8,
    intakeQuestions: gameQuestions,
    requirements: [{ resourceType: "table", quantity: 1 }],
  },
  {
    id: SEED_IDS.services.gameCentre.threeHours,
    name: "Table booking - 3 hours",
    description: "A table and games for three hours.",
    durationMin: 180,
    bufferAfterMin: 10,
    priceCents: rupees(950),
    minParty: 1,
    maxParty: 8,
    intakeQuestions: gameQuestions,
    requirements: [{ resourceType: "table", quantity: 1 }],
  },
];

const gameDocuments: SeedDocument[] = [
  {
    type: "privacy",
    title: "Privacy policy",
    content: [
      SAMPLE_NOTICE,
      "Gamistry stores your name, WhatsApp number, party size, and notes about birthdays or games so we can set the table up.",
      "We use those details for your booking and do not sell them. Ask us if you want a copy or want them deleted.",
    ].join("\n\n"),
  },
  {
    type: "terms",
    title: "Terms of service",
    content: [
      SAMPLE_NOTICE,
      "A Gamistry booking holds one table for the hours you paid for. You choose a 1 hour, 2 hour, or 3 hour session.",
      "Please handle games carefully and tell a host if a piece is missing before you start.",
    ].join("\n\n"),
  },
  {
    type: "cancellation",
    title: "Cancellation policy",
    content: cancellationPolicy(gameConfig.cancellation_window_hours),
  },
  {
    type: "no_show",
    title: "No-show policy",
    content: noShowPolicy("Gamistry"),
  },
  {
    type: "faq",
    title: "Frequently asked questions",
    content: [
      "Q: Is there parking?",
      "A: Street parking on Kennet Lane is limited. Egmore metro is a short walk.",
      "",
      "Q: What payment methods do you accept?",
      "A: UPI, cards, and cash. You pay for the length of the table booking.",
      "",
      "Q: What should I bring?",
      "A: Nothing. We set the games up. Tell us which ones you want when you book.",
      "",
      "Q: Do you serve food and drinks?",
      "A: Snacks and drinks are sold at the counter. Outside food and drinks are not allowed.",
      "",
      "Q: How large a group can I book?",
      "A: Tables seat 4, 6, or 8. A booking can be for 1 to 8 people.",
      "",
      "Q: How do I reschedule?",
      `A: Message us at least ${gameConfig.cancellation_window_hours} hours before the start and we will move the session.`,
    ].join("\n"),
  },
  {
    type: "rules",
    title: "House rules",
    content: [
      "Shoes off at the play tables.",
      "Outside food and drinks are not allowed.",
      "Guests under 12 come with an adult.",
      "Handle games gently and return every piece before you leave.",
      "No running between tables.",
    ].join("\n"),
  },
  {
    type: "price_list",
    title: "Price list",
    content: priceList(gameServices),
  },
];

export const seedStores: SeedStore[] = [
  {
    id: SEED_IDS.salon,
    name: "Glow Salon",
    type: "salon",
    description: "Neighbourhood salon in Chennai for cuts, beard trims, and colour.",
    address: "14, Cathedral Road, Gopalapuram, Chennai 600086",
    contactPhone: "+914430010101",
    ownerWhatsapp: "+919810000101",
    config: salonConfig,
    resources: [
      { id: SEED_IDS.resources.salon.priya, type: "staff", name: "Priya", capacity: 1 },
      { id: SEED_IDS.resources.salon.arjun, type: "staff", name: "Arjun", capacity: 1 },
    ],
    services: salonServices,
    rules: [
      { resourceId: null, weekdays: MON_SAT, start: "10:00", end: "20:00" },
      {
        resourceId: SEED_IDS.resources.salon.arjun,
        weekdays: MON_SAT,
        start: "10:00",
        end: "14:00",
      },
      {
        resourceId: SEED_IDS.resources.salon.arjun,
        weekdays: MON_SAT,
        start: "17:00",
        end: "20:00",
      },
    ],
    exceptions: [
      {
        resourceId: null,
        daysFromNow: 14,
        reason: "Public holiday",
        kind: "full_day",
      },
      {
        resourceId: SEED_IDS.resources.salon.arjun,
        daysFromNow: 3,
        reason: "Leave",
        kind: "full_day",
      },
    ],
    documents: salonDocuments,
  },
  {
    id: SEED_IDS.restaurant,
    name: "Spice Route",
    type: "restaurant",
    description: "South Indian and coastal restaurant in T. Nagar.",
    address: "88, Pondy Bazaar, T. Nagar, Chennai 600017",
    contactPhone: "+914430010102",
    ownerWhatsapp: "+919810000102",
    config: restaurantConfig,
    resources: [
      { id: SEED_IDS.resources.restaurant.t1, type: "table", name: "T1", capacity: 2 },
      { id: SEED_IDS.resources.restaurant.t2, type: "table", name: "T2", capacity: 2 },
      { id: SEED_IDS.resources.restaurant.t3, type: "table", name: "T3", capacity: 4 },
      { id: SEED_IDS.resources.restaurant.t4, type: "table", name: "T4", capacity: 4 },
      { id: SEED_IDS.resources.restaurant.t5, type: "table", name: "T5", capacity: 6 },
    ],
    services: restaurantServices,
    rules: [
      { resourceId: null, weekdays: ALL_DAYS, start: "12:00", end: "15:00" },
      { resourceId: null, weekdays: ALL_DAYS, start: "19:00", end: "23:00" },
    ],
    exceptions: [
      {
        resourceId: null,
        daysFromNow: 7,
        reason: "Private event",
        kind: "window",
        start: "12:00",
        end: "15:00",
      },
    ],
    documents: restaurantDocuments,
  },
  {
    id: SEED_IDS.gameCentre,
    name: "Gamistry",
    type: "game_centre",
    description: "Board game centre in Egmore, Chennai.",
    address: "42, Kennet Lane, Egmore, Chennai 600008",
    contactPhone: "+914430010103",
    ownerWhatsapp: "+919810000103",
    config: gameConfig,
    resources: [
      { id: SEED_IDS.resources.gameCentre.table1, type: "table", name: "Table 1", capacity: 4 },
      { id: SEED_IDS.resources.gameCentre.table2, type: "table", name: "Table 2", capacity: 4 },
      { id: SEED_IDS.resources.gameCentre.table3, type: "table", name: "Table 3", capacity: 6 },
      { id: SEED_IDS.resources.gameCentre.table4, type: "table", name: "Table 4", capacity: 8 },
    ],
    services: gameServices,
    rules: [
      { resourceId: null, weekdays: MON_FRI, start: "12:00", end: "22:00" },
      {
        resourceId: null,
        weekdays: [WEEKDAY.saturday, WEEKDAY.sunday],
        start: "11:00",
        end: "23:00",
      },
    ],
    exceptions: [],
    documents: gameDocuments,
  },
];

export const sampleCustomers: SampleCustomer[] = [
  { phone: "+919999900001", name: "Test Customer One" },
  { phone: "+919999900002", name: "Test Customer Two" },
];

export const sampleBookings: SampleBooking[] = [
  {
    businessId: SEED_IDS.salon,
    serviceId: SEED_IDS.services.salon.haircut,
    resourceId: SEED_IDS.resources.salon.priya,
    customerPhone: "+919999900001",
    start: "11:00",
    partySize: 1,
    idempotencyKey: "seed-glow-haircut-tomorrow",
  },
  {
    businessId: SEED_IDS.restaurant,
    serviceId: SEED_IDS.services.restaurant.tableReservation,
    resourceId: SEED_IDS.resources.restaurant.t1,
    customerPhone: "+919999900001",
    start: "19:00",
    partySize: 2,
    idempotencyKey: "seed-spice-route-dinner-tomorrow",
  },
  {
    businessId: SEED_IDS.gameCentre,
    serviceId: SEED_IDS.services.gameCentre.oneHour,
    resourceId: SEED_IDS.resources.gameCentre.table1,
    customerPhone: "+919999900002",
    start: "15:00",
    partySize: 2,
    idempotencyKey: "seed-gamistry-one-hour-tomorrow",
  },
];

export function findSeedService(serviceId: string): SeedService {
  for (const store of seedStores) {
    const service = store.services.find((item) => item.id === serviceId);
    if (service) {
      return service;
    }
  }
  throw new Error(`Unknown seed service ${serviceId}`);
}
