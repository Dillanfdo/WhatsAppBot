import { invalid, missingStore, readJson, readStoreId, respond } from "@/lib/api";
import { createService, listServices } from "@/lib/catalog";
import { serviceWriteSchema } from "@/lib/validation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  return respond(async () => ({ services: await listServices(id) }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  const parsed = serviceWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Invalid service.");
  return respond(async () => ({ service: await createService(id, parsed.data) }), 201);
}
