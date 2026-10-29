import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { StoreSetupNeed } from "@/lib/dashboard";
import { setupItemLabel } from "@/lib/store-readiness";

export const SetupNeededRow = ({ store }: { store: StoreSetupNeed }) => (
  <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
    <div>
      <p className="font-medium">{store.name}</p>
      <p className="text-muted-foreground">Still needed: {store.missing.map(setupItemLabel).join(", ")}</p>
    </div>
    <Link
      className={buttonVariants({ size: "sm", variant: "outline" })}
      href={`/admin/onboarding/${store.id}?step=${store.resumeStep}`}
    >
      Continue setup
    </Link>
  </li>
);
