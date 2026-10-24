import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, customers, messages } from "@/lib/db/schema";
import type { LlmMessage, LlmToolCall } from "@/lib/ai/llm/types";

export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: Record<string, unknown>;
  createdAt: Date;
};

const upsertCustomerId = async (storeId: string, phone: string): Promise<string> => {
  const inserted = await db
    .insert(customers)
    .values({ businessId: storeId, phone })
    .onConflictDoUpdate({
      target: [customers.businessId, customers.phone],
      set: { phone },
    })
    .returning({ id: customers.id });
  const customer = inserted[0];
  if (!customer) {
    throw new Error("Customer upsert did not return an id");
  }
  return customer.id;
};

export const findConversation = async (input: {
  storeId: string;
  phone: string;
  sessionId?: string;
}): Promise<{ id: string } | null> => {
  if (input.sessionId) {
    const rows = await db
      .select({ id: conversations.id, status: conversations.status })
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.sessionId),
          eq(conversations.businessId, input.storeId),
          eq(conversations.externalId, input.phone),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || row.status === "closed") {
      return null;
    }
    return { id: row.id };
  }
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.businessId, input.storeId),
        eq(conversations.externalId, input.phone),
        eq(conversations.channel, "web_test"),
        eq(conversations.status, "active"),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  return rows[0] ?? null;
};

export const createConversation = async (storeId: string, phone: string): Promise<string> => {
  const customerId = await upsertCustomerId(storeId, phone);
  const inserted = await db
    .insert(conversations)
    .values({
      businessId: storeId,
      customerId,
      channel: "web_test",
      externalId: phone,
      status: "active",
    })
    .returning({ id: conversations.id });
  const row = inserted[0];
  if (!row) {
    throw new Error("Conversation insert did not return an id");
  }
  return row.id;
};

export const closeConversation = async (conversationId: string): Promise<boolean> => {
  const updated = await db
    .update(conversations)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning({ id: conversations.id });
  return updated.length > 0;
};

export const findDuplicateReply = async (
  storeId: string,
  phone: string,
  messageId: string,
): Promise<{ conversationId: string; reply: string } | null> => {
  const userRows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(messages.providerMessageId, messageId),
        eq(messages.role, "user"),
        eq(conversations.businessId, storeId),
        eq(conversations.externalId, phone),
      ),
    )
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return null;
  }
  const replies = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, user.conversationId), eq(messages.role, "assistant")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const content = replies[0]?.content as { text?: string } | undefined;
  if (!content?.text) {
    return null;
  }
  return { conversationId: user.conversationId, reply: content.text };
};

export const appendMessage = async (input: {
  conversationId: string;
  role: "user" | "assistant" | "tool";
  content: Record<string, unknown>;
  providerMessageId?: string;
}): Promise<void> => {
  await db.insert(messages).values({
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    providerMessageId: input.providerMessageId,
  });
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, input.conversationId));
};

export const loadHistory = async (conversationId: string): Promise<StoredMessage[]> => {
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(20);
  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role as StoredMessage["role"],
    content: row.content,
    createdAt: row.createdAt,
  }));
};

export const listMessages = async (conversationId: string): Promise<StoredMessage[]> => {
  const rows = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
  return rows.map((row) => ({
    id: row.id,
    role: row.role as StoredMessage["role"],
    content: row.content,
    createdAt: row.createdAt,
  }));
};

export const historyToLlm = (history: StoredMessage[]): LlmMessage[] =>
  history.flatMap((message): LlmMessage[] => {
    if (message.role === "user") {
      const text = typeof message.content.text === "string" ? message.content.text : "";
      return [{ role: "user", content: text }];
    }
    if (message.role === "assistant") {
      const text = typeof message.content.text === "string" ? message.content.text : "";
      const toolCalls = Array.isArray(message.content.toolCalls)
        ? (message.content.toolCalls as LlmToolCall[])
        : undefined;
      return [{ role: "assistant", content: text, ...(toolCalls ? { toolCalls } : {}) }];
    }
    const name = typeof message.content.name === "string" ? message.content.name : "tool";
    return [{ role: "tool", toolName: name, content: JSON.stringify(message.content.output ?? message.content) }];
  });
