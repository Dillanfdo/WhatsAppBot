import { z } from "zod";
import { getStore, updateStore } from "@/lib/stores";
import { updateStoreSchema } from "@/lib/validation";

const storeIdContext = async (context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return { error: Response.json({ error: "Invalid store id" }, { status: 400 }) };
  }
  return { id };
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsed = await storeIdContext(context);
  if ("error" in parsed) {
    return parsed.error;
  }

  const store = await getStore(parsed.id);
  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  return Response.json({ store });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const parsedId = await storeIdContext(context);
  if ("error" in parsedId) {
    return parsedId.error;
  }

  const body: unknown = await request.json();
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid store payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const store = await updateStore(parsedId.id, parsed.data);
  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  return Response.json({ store });
}
