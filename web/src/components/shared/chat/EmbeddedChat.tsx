"use client";

import { ChatWindow } from "@/components/shared/chat/ChatWindow";
import { DebugPanel } from "@/components/shared/chat/DebugPanel";
import { SessionBar } from "@/components/shared/chat/SessionBar";
import { TestPhoneField } from "@/components/shared/chat/TestPhoneField";
import { useChatSession } from "@/components/shared/chat/useChatSession";

type EmbeddedChatProps = {
  storeId: string;
  storeName?: string;
};

export const EmbeddedChat = ({ storeId, storeName }: EmbeddedChatProps) => {
  const session = useChatSession({ fixedStoreId: storeId });
  const healthProblem = session.health && (!session.health.reachable || !session.health.modelInstalled);

  return (
    <div className="space-y-4">
      {healthProblem ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {session.health?.message}
        </p>
      ) : null}
      <TestPhoneField
        presetId={session.presetId}
        phone={session.phone}
        onPresetChange={session.setPreset}
        onPhoneChange={session.setPhone}
      />
      <SessionBar storeName={storeName ?? session.selectedStore?.name ?? "this store"} onNewSession={() => void session.startNewSession()} />
      <ChatWindow
        key={session.sessionKey}
        messages={session.messages}
        onSend={session.sendMessage}
        sending={session.sending}
      />
      <DebugPanel messages={session.messages} health={session.health} />
    </div>
  );
};
