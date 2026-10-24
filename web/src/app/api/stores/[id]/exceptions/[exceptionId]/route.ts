import { z } from "zod";
import { invalid, respond } from "@/lib/api";
import { deleteException } from "@/lib/catalog";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; exceptionId: string }> },
) {
  const { id, exceptionId } = await context.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(exceptionId).success) {
    return invalid("Invalid id");
  }
  return respond(async () => {
    await deleteException(id, exceptionId);
    return { ok: true };
  });
}
