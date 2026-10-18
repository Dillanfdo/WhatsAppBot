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
