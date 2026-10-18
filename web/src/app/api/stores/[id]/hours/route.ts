import { z } from "zod";
import { replaceStoreHours } from "@/lib/stores";
import { updateStoreHoursSchema } from "@/lib/validation";

const storeIdContext = async (context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return { error: Response.json({ error: "Invalid store id" }, { status: 400 }) };
  }
  return { id };
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsedId = await storeIdContext(context);
  if ("error" in parsedId) {
    return parsedId.error;
  }

  const body: unknown = await request.json();
  const parsed = updateStoreHoursSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid store hours", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const hours = await replaceStoreHours(parsedId.id, parsed.data);
  if (!hours) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  return Response.json({ hours });
}
