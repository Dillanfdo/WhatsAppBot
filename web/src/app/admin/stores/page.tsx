import { Suspense } from "react";
import { StoreListHeader } from "@/components/admin/StoreListHeader";
import { StoreListSection } from "@/components/admin/StoreListSection";

const StoresPage = () => (
  <div className="space-y-4">
    <StoreListHeader />
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading stores…</p>}>
      <StoreListSection />
    </Suspense>
  </div>
);

export default StoresPage;
