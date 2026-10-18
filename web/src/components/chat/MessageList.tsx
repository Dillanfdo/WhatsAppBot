import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { ChatMessage } from "@/components/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
};

export const MessageList = ({ messages }: MessageListProps) => (
  <ScrollArea className="flex-1 p-4">
    <div className="flex flex-col gap-3">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Send a message to test the booking assistant.
        </p>
      ) : null}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  </ScrollArea>
);
