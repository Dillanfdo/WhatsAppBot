import { z } from "zod";
import { invalid, missingStore, readJson, respond } from "@/lib/api";
import { deleteResource, updateResource } from "@/lib/catalog";
import { resourceTypeSchema } from "@/lib/validation";

const patchSchema = z.object({
  type: resourceTypeSchema.optional(),
  name: z.string().trim().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string; resourceId: string }> }) {
  const { id, resourceId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(resourceId).success) return missingStore();
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid resource.");
  return respond(async () => ({ resource: await updateResource(id, resourceId, parsed.data) }));
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; resourceId: string }> }) {
  const { id, resourceId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(resourceId).success) return missingStore();
  return respond(async () => deleteResource(id, resourceId));
}
