import { z } from "zod";
import { invalid, readJson, respond } from "@/lib/api";
import { saveDocument } from "@/lib/catalog";

const types = ["privacy", "terms", "faq", "cancellation", "no_show", "rules", "price_list"] as const;

const bodySchema = z.object({
  title: z.string().trim().min(1),
  content: z.string(),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = await context.params;
  if (!z.uuid().safeParse(id).success || !types.includes(type as (typeof types)[number])) {
    return invalid("Unknown document type.");
  }
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid("Invalid document.");
  return respond(async () => ({ document: await saveDocument(id, type, parsed.data.title, parsed.data.content) }));
}
