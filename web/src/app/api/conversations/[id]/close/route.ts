import { z } from "zod";
import { closeConversation } from "@/lib/ai/conversations";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: { code: "not_found", message: "Conversation not found." } }, { status: 404 });
  }
  const closed = await closeConversation(id);
  if (!closed) {
    return Response.json({ error: { code: "not_found", message: "Conversation not found." } }, { status: 404 });
  }
  return Response.json({ id, status: "closed" });
}
