export const REQUIRED_DOCUMENT_TYPES = ["privacy", "terms", "cancellation"] as const;

export type SetupItem =
  | "hours"
  | "resource"
  | "service"
  | (typeof REQUIRED_DOCUMENT_TYPES)[number];

export type ReadinessFacts = {
  businessHourCount: number;
  activeResourceCount: number;
  activeServiceCount: number;
  documentTypes: readonly string[];
};

export type StoreReadiness = {
  ready: boolean;
  missing: SetupItem[];
};

export const missingSetupItems = (facts: ReadinessFacts): SetupItem[] => {
  const missing: SetupItem[] = [];
  if (facts.businessHourCount < 1) {
    missing.push("hours");
  }
  if (facts.activeResourceCount < 1) {
    missing.push("resource");
  }
  if (facts.activeServiceCount < 1) {
    missing.push("service");
  }

  const present = new Set(facts.documentTypes);
  for (const type of REQUIRED_DOCUMENT_TYPES) {
    if (!present.has(type)) {
      missing.push(type);
    }
  }

  return missing;
};

export const readinessFromFacts = (facts: ReadinessFacts): StoreReadiness => {
  const missing = missingSetupItems(facts);
  return { ready: missing.length === 0, missing };
};

export const SETUP_ITEM_LABELS: Record<SetupItem, string> = {
  hours: "opening hours",
  resource: "at least one resource",
  service: "at least one service",
  privacy: "Privacy Policy",
  terms: "Terms and Conditions",
  cancellation: "cancellation policy",
};

/** Onboarding wizard step (1-7) where each missing item is fixed. */
export const SETUP_ITEM_STEP: Record<SetupItem, number> = {
  hours: 2,
  resource: 3,
  service: 4,
  privacy: 6,
  terms: 6,
  cancellation: 6,
};

export const setupItemLabel = (item: string): string =>
  item in SETUP_ITEM_LABELS ? SETUP_ITEM_LABELS[item as SetupItem] : item;

export const firstSetupStep = (missing: readonly SetupItem[]): number =>
  missing.length === 0 ? 7 : Math.min(...missing.map((item) => SETUP_ITEM_STEP[item]));
