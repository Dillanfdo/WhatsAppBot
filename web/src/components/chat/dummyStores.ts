export const DUMMY_STORES = [
  { id: "store_salon", name: "Sunrise Salon" },
  { id: "store_dentist", name: "Green Park Dental" },
  { id: "store_games", name: "Meeple Board Game Cafe" },
] as const;

export type DummyStore = (typeof DUMMY_STORES)[number];
