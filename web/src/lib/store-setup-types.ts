import type { ServiceView } from "@/lib/catalog";

export type { StoreResource } from "@/lib/validation";

// Type-only import: erased at compile time, so no server code reaches the client bundle.
export type ServiceRow = ServiceView;

export type DocRow = { type: string; title: string; content: string; version: number; createdAt?: string };

export type ExceptionRow = { id: string; startsAt: string; endsAt: string; reason: string | null };

export const RESOURCE_TYPES = ["staff", "table", "room", "console", "chair"] as const;

export const DOCUMENT_TYPES = ["privacy", "terms", "cancellation", "no_show", "rules", "price_list", "faq"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  privacy: "Privacy Policy",
  terms: "Terms and Conditions",
  cancellation: "Cancellation policy",
  no_show: "No-show policy",
  rules: "House rules",
  price_list: "Price list",
  faq: "FAQs",
};
