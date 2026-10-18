import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const StoreListHeader = () => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-xl font-semibold">Stores</h1>
      <p className="text-sm text-muted-foreground">
        Business locations this assistant can book for.
      </p>
    </div>
    <Link className={buttonVariants()} href="/admin/stores/new">
      New store
    </Link>
  </div>
);
