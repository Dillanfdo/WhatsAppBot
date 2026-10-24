import { z } from "zod";
import { invalid, readJson, respond } from "@/lib/api";
import { updateService } from "@/lib/catalog";
import { resourceTypeSchema } from "@/lib/validation";

const bodySchema = z.object({
  requirements: z.array(z.object({ resourceType: resourceTypeSchema, quantity: z.number().int().min(1) })),
  resourceIds: z.array(z.uuid()).optional(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> },
) {
  const { id, serviceId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(serviceId).success) {
    return invalid("Invalid id");
  }
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid requirements.");
  return respond(async () => ({
    service: await updateService(id, serviceId, {
      requirements: parsed.data.requirements,
      resourceIds: parsed.data.resourceIds ?? [],
    }),
  }));
}
