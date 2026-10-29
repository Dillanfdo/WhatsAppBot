"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/fetch-error";
import { setupItemLabel } from "@/lib/store-readiness";

type ReadinessPanelProps = {
  storeId: string;
  active: boolean;
  allowGoLive?: boolean;
};

export const ReadinessPanel = ({ storeId, active, allowGoLive = true }: ReadinessPanelProps) => {
  const [missing, setMissing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(active);

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/readiness`);
    if (!response.ok) return;
    const body = (await response.json()) as { ready: boolean; missing: string[] };
    setReady(body.ready);
    setMissing(body.missing);
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const goLive = async () => {
    const response = await fetch(`/api/stores/${storeId}/activate`, { method: "POST" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Store is not ready."));
      await load();
      return;
    }
    setLive(true);
    toast.success("Store is live.");
  };

  const pause = async () => {
    const response = await fetch(`/api/stores/${storeId}/deactivate`, { method: "POST" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not pause the store."));
      return;
    }
    setLive(false);
    toast.success("Store paused.");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <div>
        <p className="font-medium">{live ? "Live" : ready ? "Ready to go live" : "Setup incomplete"}</p>
        {missing.length > 0 ? (
          <p className="text-muted-foreground">Still needed: {missing.map(setupItemLabel).join(", ")}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!ready || live || !allowGoLive} onClick={() => void goLive()}>
          Go live
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!live} onClick={() => void pause()}>
          Pause
        </Button>
      </div>
    </div>
  );
};
