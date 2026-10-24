import { z } from "zod";
import { invalid, missingStore, readJson, readStoreId, respond } from "@/lib/api";
import { createService, listServices } from "@/lib/catalog";
import { resourceTypeSchema } from "@/lib/validation";

const requirementSchema = z.object({
  resourceType: resourceTypeSchema,
  quantity: z.number().int().min(1),
});

const writeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional(),
  durationMin: z.number().int().positive(),
  bufferAfterMin: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  minParty: z.number().int().min(1).optional(),
  maxParty: z.number().int().min(1).optional(),
  intakeQuestions: z.array(z.object({ label: z.string(), required: z.boolean().optional() })).optional(),
  isActive: z.boolean().optional(),
  requirements: z.array(requirementSchema).optional(),
  resourceIds: z.array(z.uuid()).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  return respond(async () => ({ services: await listServices(id) }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  const parsed = writeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid service.");
  return respond(async () => ({ service: await createService(id, parsed.data) }), 201);
}
