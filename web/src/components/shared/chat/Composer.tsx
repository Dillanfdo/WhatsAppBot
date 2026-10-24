"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ComposerProps = {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
};

export const Composer = ({ onSend, disabled }: ComposerProps) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const busy = disabled || sending;

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) {
      return;
    }
    setSending(true);
    try {
      await onSend(text);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await send();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        disabled={busy}
      />
      <Button type="submit" disabled={busy || !draft.trim()}>
        Send
      </Button>
    </form>
  );
};
