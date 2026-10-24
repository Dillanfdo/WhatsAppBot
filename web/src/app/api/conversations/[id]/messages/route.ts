import { z } from "zod";
import { listMessages } from "@/lib/ai/conversations";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: { code: "not_found", message: "Conversation not found." } }, { status: 404 });
  }
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (!rows[0]) {
    return Response.json({ error: { code: "not_found", message: "Conversation not found." } }, { status: 404 });
  }
  const history = await listMessages(id);
  return Response.json({
    messages: history.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}
