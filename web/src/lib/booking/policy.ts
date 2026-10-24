import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { businessDocuments } from "@/lib/db/schema";

const DOCUMENT_TYPES = [
  "privacy",
  "terms",
  "faq",
  "cancellation",
  "no_show",
  "rules",
  "price_list",
] as const;

export type PolicyType = (typeof DOCUMENT_TYPES)[number];

export const isPolicyType = (value: string): value is PolicyType =>
  (DOCUMENT_TYPES as readonly string[]).includes(value);

export async function getPolicy(storeId: string, type: PolicyType): Promise<string | null> {
  const rows = await db
    .select({ content: businessDocuments.content })
    .from(businessDocuments)
    .where(and(eq(businessDocuments.businessId, storeId), eq(businessDocuments.type, type)))
    .orderBy(desc(businessDocuments.version))
    .limit(1);
  return rows[0]?.content ?? null;
}
