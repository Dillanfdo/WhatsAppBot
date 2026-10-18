"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ComposerProps = {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
};

export const Composer = ({ onSend, disabled }: ComposerProps) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || disabled) {
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

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Type a message"
        disabled={disabled || sending}
      />
      <Button type="submit" disabled={disabled || sending || !draft.trim()}>
        Send
      </Button>
    </form>
  );
};
