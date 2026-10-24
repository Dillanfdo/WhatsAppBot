import { missingStore, readStoreId, respond } from "@/lib/api";
import { listDocuments } from "@/lib/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) return missingStore();
  return respond(async () => ({ documents: await listDocuments(id) }));
}
