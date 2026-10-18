import { z } from "zod";
import { getStoreReadiness } from "@/lib/stores";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid store id" }, { status: 400 });
  }

  const readiness = await getStoreReadiness(id);
  if (!readiness) {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }

  return Response.json(readiness);
}
