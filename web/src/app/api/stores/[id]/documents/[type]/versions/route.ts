import { z } from "zod";
import { invalid, respond } from "@/lib/api";
import { listDocumentVersions } from "@/lib/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = await context.params;
  if (!z.uuid().safeParse(id).success) return invalid("Invalid store.");
  return respond(async () => ({ versions: await listDocumentVersions(id, type) }));
}
