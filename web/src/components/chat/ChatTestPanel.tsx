"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { DebugPanel } from "@/components/chat/DebugPanel";
import { SessionBar } from "@/components/chat/SessionBar";
import { StorePicker } from "@/components/chat/StorePicker";
import { TestPhoneField } from "@/components/chat/TestPhoneField";
import { useChatSession } from "@/components/chat/useChatSession";

export const ChatTestPanel = () => {
  const {
    storeId,
    setStoreId,
    phone,
    setPhone,
    sessionKey,
    messages,
    selectedStore,
    startNewSession,
    sendMessage,
  } = useChatSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chatbot test</CardTitle>
        <CardDescription>
          Talk to the booking assistant as if you were a WhatsApp customer.
          Replies currently echo the message.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <StorePicker storeId={storeId} onStoreIdChange={setStoreId} />
          <TestPhoneField phone={phone} onPhoneChange={setPhone} />
        </div>
        <SessionBar storeName={selectedStore.name} onNewSession={startNewSession} />
        <ChatWindow key={sessionKey} messages={messages} onSend={sendMessage} />
        <DebugPanel />
      </CardContent>
    </Card>
  );
};
