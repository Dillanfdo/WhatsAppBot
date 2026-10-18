"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DUMMY_STORES } from "@/components/chat/dummyStores";
import type { ChatMessage } from "@/components/chat/types";
import { agentResultSchema } from "@/lib/validation";

export const useChatSession = () => {
  const [storeId, setStoreId] = useState<string>(DUMMY_STORES[0].id);
  const [phone, setPhone] = useState("+919876543210");
  const [sessionKey, setSessionKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const selectedStore = useMemo(
    () => DUMMY_STORES.find((store) => store.id === storeId) ?? DUMMY_STORES[0],
    [storeId],
  );

  const startNewSession = () => {
    setMessages([]);
    setSessionKey((value) => value + 1);
  };

  const sendMessage = async (text: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((current) => [...current, userMessage]);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        phone,
        message: text,
      }),
    });

    if (!response.ok) {
      toast.error("Chat request failed");
      return;
    }

    const parsedResult = agentResultSchema.safeParse(await response.json());
    if (!parsedResult.success) {
      toast.error("Unexpected chat response");
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: parsedResult.data.reply,
      },
    ]);
  };

  return {
    storeId,
    setStoreId,
    phone,
    setPhone,
    sessionKey,
    messages,
    selectedStore,
    startNewSession,
    sendMessage,
  };
};
