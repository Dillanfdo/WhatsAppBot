"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatWindow } from "@/components/shared/chat/ChatWindow";
import { DebugPanel } from "@/components/shared/chat/DebugPanel";
import { SessionBar } from "@/components/shared/chat/SessionBar";
import { StorePicker } from "@/components/shared/chat/StorePicker";
import { TestPhoneField } from "@/components/shared/chat/TestPhoneField";
import { useChatSession } from "@/components/shared/chat/useChatSession";

export const ChatTestPanel = () => {
  const session = useChatSession();
  const healthProblem = session.health && (!session.health.reachable || !session.health.modelInstalled);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chatbot test</CardTitle>
        <CardDescription>Talk to the booking assistant as if you were a WhatsApp customer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {healthProblem ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {session.health?.message}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <StorePicker stores={session.stores} storeId={session.storeId} onStoreIdChange={session.setStoreId} />
          <TestPhoneField
            presetId={session.presetId}
            phone={session.phone}
            onPresetChange={session.setPreset}
            onPhoneChange={session.setPhone}
          />
        </div>
        <SessionBar
          storeName={session.selectedStore?.name ?? "a store"}
          onNewSession={() => void session.startNewSession()}
        />
        <ChatWindow
          key={session.sessionKey}
          messages={session.messages}
          onSend={session.sendMessage}
          sending={session.sending}
        />
        <DebugPanel messages={session.messages} health={session.health} />
      </CardContent>
    </Card>
  );
};
