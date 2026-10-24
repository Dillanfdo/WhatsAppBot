import { deactivateStore } from "@/lib/stores";
import { invalid, missingStore, readStoreId } from "@/lib/api";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const id = await readStoreId(context.params);
  if (!id) {
    return invalid("Invalid store id");
  }
  const store = await deactivateStore(id);
  if (!store) {
    return missingStore();
  }
  return Response.json({ store });
}
