import { SetupNeededRow } from "@/components/admin/dashboard/SetupNeededRow";
import { storesNeedingSetup } from "@/lib/dashboard";

export const SetupNeededSection = async () => {
  const stores = await storesNeedingSetup();
  if (stores.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      <h2 className="font-medium">Stores that need setup</h2>
      <ul className="space-y-2">
        {stores.map((store) => (
          <SetupNeededRow key={store.id} store={store} />
        ))}
      </ul>
    </div>
  );
};
