import type { ServiceRow } from "@/lib/store-setup-types";
import { serviceWriteSchema, type ServiceWriteInput, type StoreResource } from "@/lib/validation";

type ResourceType = StoreResource["type"];

export type ServiceDraft = {
  name: string;
  description: string;
  durationMin: number;
  bufferAfterMin: number;
  rupees: string;
  minParty: number;
  maxParty: number;
  requirements: { resourceType: ResourceType; quantity: number }[];
  resourceIds: string[];
  intakeQuestions: { key?: string; label: string; required: boolean }[];
  isActive: boolean;
};

export type DraftResult = { ok: true; payload: ServiceWriteInput } | { ok: false; message: string };

export const emptyServiceDraft = (defaultType: ResourceType = "staff"): ServiceDraft => ({
  name: "",
  description: "",
  durationMin: 30,
  bufferAfterMin: 0,
  rupees: "",
  minParty: 1,
  maxParty: 1,
  requirements: [{ resourceType: defaultType, quantity: 1 }],
  resourceIds: [],
  intakeQuestions: [],
  isActive: true,
});

export const draftFromService = (service: ServiceRow): ServiceDraft => ({
  name: service.name,
  description: service.description ?? "",
  durationMin: service.durationMin,
  bufferAfterMin: service.bufferAfterMin,
  rupees: service.priceCents === null ? "" : String(service.priceCents / 100),
  minParty: service.minParty,
  maxParty: service.maxParty,
  requirements: service.requirements.map((item) => ({
    resourceType: item.resourceType as ResourceType,
    quantity: item.quantity,
  })),
  resourceIds: service.resourceIds,
  intakeQuestions: service.intakeQuestions.map((question) => ({
    ...(question.key ? { key: question.key } : {}),
    label: question.label ?? question.prompt ?? "",
    required: question.required === true,
  })),
  isActive: service.isActive,
});

const slug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const priceToCents = (rupees: string): number | null | "invalid" => {
  const trimmed = rupees.trim();
  if (trimmed === "") {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) {
    return "invalid";
  }
  return Math.round(value * 100);
};

export const draftToPayload = (draft: ServiceDraft): DraftResult => {
  const priceCents = priceToCents(draft.rupees);
  if (priceCents === "invalid") {
    return { ok: false, message: "Enter a valid price in rupees, or leave it blank." };
  }
  if (draft.requirements.length === 0) {
    return { ok: false, message: "Add at least one required resource type." };
  }
  const parsed = serviceWriteSchema.safeParse({
    name: draft.name,
    description: draft.description.trim(),
    durationMin: draft.durationMin,
    bufferAfterMin: draft.bufferAfterMin,
    priceCents,
    minParty: draft.minParty,
    maxParty: draft.maxParty,
    requirements: draft.requirements,
    resourceIds: draft.resourceIds,
    intakeQuestions: draft.intakeQuestions
      .filter((question) => question.label.trim().length > 0)
      .map((question, index) => ({
        key: question.key ?? (slug(question.label) || `question_${index + 1}`),
        label: question.label.trim(),
        required: question.required,
      })),
    isActive: draft.isActive,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the service details." };
  }
  return { ok: true, payload: parsed.data };
};

/** One warning per required resource type that has no eligible resource big enough for the largest party. */
export const partySizeWarnings = (
  draft: Pick<ServiceDraft, "requirements" | "resourceIds" | "maxParty">,
  resources: Pick<StoreResource, "id" | "type" | "capacity" | "isActive">[],
): string[] => {
  const warnings: string[] = [];
  for (const requirement of draft.requirements) {
    const eligible = resources.filter(
      (resource) =>
        resource.isActive &&
        resource.type === requirement.resourceType &&
        (draft.resourceIds.length === 0 || draft.resourceIds.includes(resource.id)),
    );
    if (eligible.length === 0) {
      warnings.push(`No active ${requirement.resourceType} is available for this service yet.`);
      continue;
    }
    if (!eligible.some((resource) => resource.capacity >= draft.maxParty)) {
      warnings.push(`No ${requirement.resourceType} can seat a party of ${draft.maxParty}.`);
    }
    if (eligible.length < requirement.quantity) {
      warnings.push(`This service needs ${requirement.quantity} ${requirement.resourceType} at once, but only ${eligible.length} can be used.`);
    }
  }
  return warnings;
};
