import { Suspense } from "react";
import { StoreSettingsSection } from "@/components/admin/StoreSettingsSection";

const StoreSettingsPage = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => (
  <Suspense fallback={<p className="text-sm text-muted-foreground">Loading store…</p>}>
    <StoreSettingsSection params={params} />
  </Suspense>
);

export default StoreSettingsPage;
