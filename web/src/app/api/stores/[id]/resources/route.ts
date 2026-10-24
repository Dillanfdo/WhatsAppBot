import { z } from "zod";
import { invalid, missingStore, readJson, readStoreId, respond } from "@/lib/api";
import { createResource, listResources } from "@/lib/catalog";
import { resourceTypeSchema } from "@/lib/validation";

const createSchema = z.object({
  type: resourceTypeSchema,
  name: z.string().trim().min(1),
  capacity: z.number().int().min(1),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  return respond(async () => ({ resources: await listResources(id) }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid resource.");
  return respond(async () => ({ resource: await createResource({ storeId: id, ...parsed.data }) }), 201);
}
