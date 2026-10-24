export type TemplateResource = { type: "staff" | "table" | "room" | "console" | "chair"; name: string; capacity: number };
export type TemplateService = {
  name: string;
  durationMin: number;
  bufferAfterMin: number;
  priceRupees: number | null;
  minParty: number;
  maxParty: number;
  requirements: { resourceType: TemplateResource["type"]; quantity: number }[];
};

export type StoreTemplate = {
  id: string;
  label: string;
  type: "salon" | "dentist" | "game_centre" | "restaurant" | "clinic" | "other";
  resources: TemplateResource[];
  services: TemplateService[];
  openDays: number[];
  open: string;
  close: string;
  cancellationWindowHours: number;
  minNoticeHours: number;
  maxDaysAhead: number;
};

const weekday = (openDays: number[], open: string, close: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    weekday: day,
    bookable: openDays.includes(day),
    shifts: openDays.includes(day) ? [{ start: open, end: close }] : [],
  }));

export const templates: StoreTemplate[] = [
  {
    id: "salon",
    label: "Salon",
    type: "salon",
    openDays: [1, 2, 3, 4, 5, 6],
    open: "10:00",
    close: "20:00",
    cancellationWindowHours: 4,
    minNoticeHours: 2,
    maxDaysAhead: 30,
    resources: [
      { type: "staff", name: "Stylist", capacity: 1 },
    ],
    services: [
      { name: "Haircut", durationMin: 45, bufferAfterMin: 5, priceRupees: 500, minParty: 1, maxParty: 1, requirements: [{ resourceType: "staff", quantity: 1 }] },
      { name: "Beard trim", durationMin: 20, bufferAfterMin: 5, priceRupees: 200, minParty: 1, maxParty: 1, requirements: [{ resourceType: "staff", quantity: 1 }] },
      { name: "Hair colour", durationMin: 120, bufferAfterMin: 10, priceRupees: 2000, minParty: 1, maxParty: 1, requirements: [{ resourceType: "staff", quantity: 1 }] },
    ],
  },
  {
    id: "dentist",
    label: "Dentist",
    type: "dentist",
    openDays: [1, 2, 3, 4, 5, 6],
    open: "09:00",
    close: "18:00",
    cancellationWindowHours: 12,
    minNoticeHours: 2,
    maxDaysAhead: 30,
    resources: [
      { type: "staff", name: "Dentist", capacity: 1 },
      { type: "chair", name: "Chair 1", capacity: 1 },
    ],
    services: [
      {
        name: "Checkup",
        durationMin: 30,
        bufferAfterMin: 10,
        priceRupees: 800,
        minParty: 1,
        maxParty: 1,
        requirements: [
          { resourceType: "staff", quantity: 1 },
          { resourceType: "chair", quantity: 1 },
        ],
      },
    ],
  },
  {
    id: "game_centre",
    label: "Game centre",
    type: "game_centre",
    openDays: [0, 1, 2, 3, 4, 5, 6],
    open: "12:00",
    close: "22:00",
    cancellationWindowHours: 12,
    minNoticeHours: 2,
    maxDaysAhead: 21,
    resources: [
      { type: "table", name: "Table A", capacity: 4 },
      { type: "table", name: "Table B", capacity: 4 },
      { type: "table", name: "Table C", capacity: 6 },
      { type: "table", name: "Table D", capacity: 8 },
    ],
    services: [
      { name: "1 hour", durationMin: 60, bufferAfterMin: 10, priceRupees: 400, minParty: 1, maxParty: 8, requirements: [{ resourceType: "table", quantity: 1 }] },
      { name: "2 hours", durationMin: 120, bufferAfterMin: 10, priceRupees: 700, minParty: 1, maxParty: 8, requirements: [{ resourceType: "table", quantity: 1 }] },
      { name: "3 hours", durationMin: 180, bufferAfterMin: 10, priceRupees: 900, minParty: 1, maxParty: 8, requirements: [{ resourceType: "table", quantity: 1 }] },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurant",
    type: "restaurant",
    openDays: [0, 1, 2, 3, 4, 5, 6],
    open: "12:00",
    close: "23:00",
    cancellationWindowHours: 2,
    minNoticeHours: 1,
    maxDaysAhead: 14,
    resources: [
      { type: "table", name: "Table 1", capacity: 2 },
      { type: "table", name: "Table 2", capacity: 4 },
    ],
    services: [
      { name: "Table reservation", durationMin: 90, bufferAfterMin: 15, priceRupees: null, minParty: 1, maxParty: 4, requirements: [{ resourceType: "table", quantity: 1 }] },
    ],
  },
  {
    id: "clinic",
    label: "Clinic",
    type: "clinic",
    openDays: [1, 2, 3, 4, 5],
    open: "09:00",
    close: "17:00",
    cancellationWindowHours: 6,
    minNoticeHours: 2,
    maxDaysAhead: 21,
    resources: [{ type: "staff", name: "Doctor", capacity: 1 }],
    services: [
      { name: "Consult", durationMin: 20, bufferAfterMin: 5, priceRupees: 500, minParty: 1, maxParty: 1, requirements: [{ resourceType: "staff", quantity: 1 }] },
    ],
  },
  {
    id: "other",
    label: "Other",
    type: "other",
    openDays: [1, 2, 3, 4, 5],
    open: "10:00",
    close: "18:00",
    cancellationWindowHours: 4,
    minNoticeHours: 1,
    maxDaysAhead: 14,
    resources: [],
    services: [],
  },
];

export const hoursFromTemplate = (template: StoreTemplate) => ({
  days: weekday(template.openDays, template.open, template.close),
});

export const templateById = (id: string) => templates.find((template) => template.id === id) ?? null;
