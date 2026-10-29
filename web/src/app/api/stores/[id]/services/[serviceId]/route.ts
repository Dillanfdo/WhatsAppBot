import { z } from "zod";
import { invalid, readJson, respond } from "@/lib/api";
import { updateService } from "@/lib/catalog";
import { servicePatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> },
) {
  const { id, serviceId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(serviceId).success) {
    return invalid("Invalid id");
  }
  const parsed = servicePatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Invalid service.");
  return respond(async () => ({ service: await updateService(id, serviceId, parsed.data) }));
}
