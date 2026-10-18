import { z } from "zod";
import { activateStore } from "@/lib/stores";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Invalid store id" }, { status: 400 });
  }

  const result = await activateStore(id);
  if (result.status === "not_found") {
    return Response.json({ error: "Store not found" }, { status: 404 });
  }
  if (result.status === "not_ready") {
    return Response.json(
      { error: "Store is not ready to go live", missing: result.missing },
      { status: 409 },
    );
  }

  return Response.json({ store: result.store });
}
