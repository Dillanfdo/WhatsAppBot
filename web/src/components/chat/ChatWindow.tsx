import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import type { ChatMessage } from "@/components/chat/types";

type ChatWindowProps = {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
};

export const ChatWindow = ({ messages, onSend, disabled }: ChatWindowProps) => (
  <div className="flex h-[28rem] flex-col rounded-xl border">
    <MessageList messages={messages} />
    <Composer onSend={onSend} disabled={disabled} />
  </div>
);
