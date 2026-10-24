import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/shared/chat/MessageBubble";
import type { ChatMessage } from "@/components/shared/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  sending?: boolean;
};

export const MessageList = ({ messages, sending }: MessageListProps) => (
  <ScrollArea className="flex-1 p-4">
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">Send a message to test the booking assistant.</p>
      ) : null}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {sending ? <p className="text-sm text-muted-foreground">Typing…</p> : null}
    </div>
  </ScrollArea>
);
