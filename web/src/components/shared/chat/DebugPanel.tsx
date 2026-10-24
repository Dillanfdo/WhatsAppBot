"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ChatMessage } from "@/components/shared/chat/types";
import type { LlmHealth } from "@/lib/validation";

type DebugPanelProps = {
  messages: ChatMessage[];
  health: LlmHealth | null;
};

export const DebugPanel = ({ messages, health }: DebugPanelProps) => {
  const [open, setOpen] = useState(false);
  const turns = messages.filter((message) => message.role === "assistant");
  const healthy = health?.reachable && health.modelInstalled && health.toolSupport !== false;

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          Debug
          <Badge variant={healthy ? "secondary" : "destructive"}>
            {health ? `${health.provider} · ${health.model}` : "LLM unknown"}
          </Badge>
        </span>
        <span className="text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t p-3 text-sm">
          {health ? <p className="text-muted-foreground">{health.message}</p> : null}
          {turns.length === 0 ? <p className="text-muted-foreground">No tool calls yet.</p> : null}
          {turns.map((message) => (
            <div key={message.id} className="space-y-2 rounded-md border p-2">
              <p className="text-xs text-muted-foreground">
                {message.provider ?? "model"} · {message.model ?? "unknown"}
                {message.debugError ? ` · ${message.debugError}` : ""}
              </p>
              {(message.toolCalls ?? []).length === 0 ? (
                <p className="text-muted-foreground">No tools on this reply.</p>
              ) : (
                message.toolCalls?.map((call, index) => (
                  <pre key={`${message.id}-${index}`} className="overflow-auto whitespace-pre-wrap text-xs">
                    {`${call.ok ? "ok" : "error"} ${call.name} (${call.durationMs} ms)\ninput ${JSON.stringify(call.input)}\noutput ${JSON.stringify(call.output)}`}
                  </pre>
                ))
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
