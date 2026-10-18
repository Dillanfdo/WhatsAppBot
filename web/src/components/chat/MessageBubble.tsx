import type { ChatMessage } from "@/components/chat/types";

type MessageBubbleProps = {
  message: ChatMessage;
};

export const MessageBubble = ({ message }: MessageBubbleProps) => (
  <div
    className={
      message.role === "user"
        ? "ml-8 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
        : "mr-8 rounded-lg bg-muted px-3 py-2 text-sm"
    }
  >
    {message.content}
  </div>
);
