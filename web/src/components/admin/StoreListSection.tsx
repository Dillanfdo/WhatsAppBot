import { EmptyStoreList } from "@/components/admin/EmptyStoreList";
import { StoreList } from "@/components/admin/StoreList";
import { listStores } from "@/lib/stores";

export const StoreListSection = async () => {
  const stores = await listStores();

  if (stores.length === 0) {
    return <EmptyStoreList />;
  }

  return <StoreList stores={stores} />;
};
