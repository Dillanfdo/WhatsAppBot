"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/shared/chat/MessageBubble";
import type { ChatMessage } from "@/components/shared/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  sending?: boolean;
};

export const MessageList = ({ messages, sending }: MessageListProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollTop = scroller.scrollHeight;
  }, [messages, sending]);

  return (
    <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Send a message to test the booking assistant.</p>
        ) : null}
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {sending ? <p className="text-sm text-muted-foreground">Typing…</p> : null}
      </div>
    </div>
  );
};
