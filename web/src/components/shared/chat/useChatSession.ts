"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/components/shared/chat/types";
import { PHONE_PRESETS } from "@/components/shared/chat/types";
import {
  agentResultSchema,
  llmHealthSchema,
  storeListResponseSchema,
  type LlmHealth,
  type StoreSummary,
} from "@/lib/validation";

type UseChatSessionOptions = {
  fixedStoreId?: string;
};

export const useChatSession = ({ fixedStoreId }: UseChatSessionOptions = {}) => {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreIdState] = useState(fixedStoreId ?? "");
  const [presetId, setPresetId] = useState<(typeof PHONE_PRESETS)[number]["id"]>("one");
  const [phone, setPhoneState] = useState<string>(PHONE_PRESETS[0].phone);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionKey, setSessionKey] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [health, setHealth] = useState<LlmHealth | null>(null);

  const closeCurrent = useCallback(async (id: string | undefined) => {
    if (!id) {
      return;
    }
    await fetch(`/api/conversations/${id}/close`, { method: "POST" });
  }, []);

  const clearSession = useCallback(
    async (id: string | undefined) => {
      await closeCurrent(id);
      setSessionId(undefined);
      setMessages([]);
      setSessionKey((value) => value + 1);
    },
    [closeCurrent],
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/stores");
      if (!response.ok) {
        toast.error("Could not load stores");
        return;
      }
      const parsed = storeListResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        toast.error("Unexpected store list");
        return;
      }
      setStores(parsed.data.stores);
      if (!fixedStoreId) {
        setStoreIdState((current) => current || parsed.data.stores[0]?.id || "");
      }
    };
    void load();
  }, [fixedStoreId]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/health/llm");
      if (!response.ok) {
        return;
      }
      const parsed = llmHealthSchema.safeParse(await response.json());
      if (parsed.success) {
        setHealth(parsed.data);
      }
    };
    void load();
  }, []);

  const setStoreId = (next: string) => {
    if (next === storeId) {
      return;
    }
    void clearSession(sessionId);
    setStoreIdState(next);
  };

  const setPhone = (next: string) => {
    if (next === phone) {
      return;
    }
    void clearSession(sessionId);
    setPhoneState(next);
  };

  const setPreset = (next: (typeof PHONE_PRESETS)[number]["id"]) => {
    setPresetId(next);
    const preset = PHONE_PRESETS.find((item) => item.id === next);
    if (preset && preset.id !== "custom") {
      setPhone(preset.phone);
    }
  };

  const startNewSession = async () => {
    await clearSession(sessionId);
  };

  const sendMessage = async (text: string) => {
    if (!storeId) {
      toast.error("Choose a store first");
      return;
    }
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((current) => [...current, userMessage]);
    setSending(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          phone,
          message: text,
          messageId: crypto.randomUUID(),
          ...(sessionId ? { sessionId } : {}),
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
      setSessionId(parsedResult.data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: parsedResult.data.reply,
          toolCalls: parsedResult.data.toolCalls,
          model: parsedResult.data.model,
          provider: parsedResult.data.provider,
          debugError: parsedResult.data.debugError,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const selectedStore = stores.find((store) => store.id === storeId) ?? null;

  return {
    stores,
    storeId,
    setStoreId,
    presetId,
    setPreset,
    phone,
    setPhone,
    sessionKey,
    messages,
    selectedStore,
    startNewSession,
    sendMessage,
    sending,
    health,
  };
};
