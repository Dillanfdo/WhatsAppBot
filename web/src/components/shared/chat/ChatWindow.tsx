import { Composer } from "@/components/shared/chat/Composer";
import { MessageList } from "@/components/shared/chat/MessageList";
import type { ChatMessage } from "@/components/shared/chat/types";

type ChatWindowProps = {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  sending?: boolean;
};

export const ChatWindow = ({ messages, onSend, sending }: ChatWindowProps) => (
  <div className="flex h-[28rem] min-h-0 flex-col overflow-hidden rounded-xl border">
    <MessageList messages={messages} sending={sending} />
    <Composer onSend={onSend} disabled={sending} />
  </div>
);
