import { notFound } from "next/navigation";
import { z } from "zod";
import { StoreSettingsCard } from "@/components/admin/StoreSettingsCard";
import { getStore, listStoreHours, listStoreResources } from "@/lib/stores";

type StoreSettingsSectionProps = {
  params: Promise<{ id: string }>;
};

export const StoreSettingsSection = async ({ params }: StoreSettingsSectionProps) => {
  const { id: storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) {
    notFound();
  }

  const store = await getStore(storeId);
  if (!store) {
    notFound();
  }

  const [storeResources, hours] = await Promise.all([
    listStoreResources(storeId),
    listStoreHours(storeId),
  ]);
  if (!hours) {
    notFound();
  }

  return <StoreSettingsCard store={store} resources={storeResources} hours={hours} />;
};
