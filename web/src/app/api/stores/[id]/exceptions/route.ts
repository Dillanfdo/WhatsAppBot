import { z } from "zod";
import { invalid, missingStore, readJson, readStoreId, respond } from "@/lib/api";
import { createException, listExceptions } from "@/lib/catalog";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  reason: z.string().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  return respond(async () => ({ exceptions: await listExceptions(id) }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid closure.");
  return respond(async () => ({ exception: await createException({ storeId: id, ...parsed.data }) }), 201);
}
