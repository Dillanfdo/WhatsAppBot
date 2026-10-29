"use client";

import { useState } from "react";
import Link from "next/link";
import { EmbeddedChat } from "@/components/shared/chat/EmbeddedChat";
import { ReadinessPanel } from "@/components/shared/store-setup/ReadinessPanel";
import { buttonVariants } from "@/components/ui/button";
import type { StoreDetails } from "@/lib/validation";

export const ReviewStep = ({ store }: { store: StoreDetails }) => {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-4">
      <ReadinessPanel storeId={store.id} active={store.isActive} allowGoLive={confirmed} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        I confirm the information above is accurate.
      </label>
      {!confirmed ? <p className="text-sm text-muted-foreground">Tick the box to enable Go live.</p> : null}
      <h2 className="text-sm font-medium">Try your assistant</h2>
      <EmbeddedChat storeId={store.id} storeName={store.name} />
      <Link className={buttonVariants({ variant: "outline" })} href="/admin">
        Go to dashboard
      </Link>
    </div>
  );
};
