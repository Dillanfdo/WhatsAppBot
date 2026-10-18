"use client";

import { useState } from "react";

export const DebugPanel = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        Debug
        <span className="text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="border-t p-3 text-sm text-muted-foreground">
          TODO: show tool calls and results for this turn
        </div>
      ) : null}
    </div>
  );
};
