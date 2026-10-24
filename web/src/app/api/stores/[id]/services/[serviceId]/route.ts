import { z } from "zod";
import { invalid, readJson, respond } from "@/lib/api";
import { updateService } from "@/lib/catalog";
import { resourceTypeSchema } from "@/lib/validation";

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  bufferAfterMin: z.number().int().min(0).optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  minParty: z.number().int().min(1).optional(),
  maxParty: z.number().int().min(1).optional(),
  intakeQuestions: z.array(z.object({ label: z.string(), required: z.boolean().optional() })).optional(),
  isActive: z.boolean().optional(),
  requirements: z.array(z.object({ resourceType: resourceTypeSchema, quantity: z.number().int().min(1) })).optional(),
  resourceIds: z.array(z.uuid()).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> },
) {
  const { id, serviceId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(serviceId).success) {
    return invalid("Invalid id");
  }
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid service.");
  return respond(async () => ({ service: await updateService(id, serviceId, parsed.data) }));
}
