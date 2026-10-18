"use client";

import { Button } from "@/components/ui/button";

type SessionBarProps = {
  storeName: string;
  onNewSession: () => void;
};

export const SessionBar = ({ storeName, onNewSession }: SessionBarProps) => (
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <span>Session for {storeName}</span>
    <Button type="button" variant="outline" onClick={onNewSession}>
      New session
    </Button>
  </div>
);
