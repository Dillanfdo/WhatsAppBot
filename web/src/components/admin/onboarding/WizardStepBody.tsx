import { ReviewStep } from "@/components/admin/onboarding/ReviewStep";
import { StoreHoursForm } from "@/components/admin/StoreHoursForm";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { ClosureEditor } from "@/components/shared/store-setup/ClosureEditor";
import { PolicyEditor } from "@/components/shared/store-setup/PolicyEditor";
import { ResourceEditor } from "@/components/shared/store-setup/ResourceEditor";
import { ServiceEditor } from "@/components/shared/store-setup/ServiceEditor";
import type { StoreDetails, UpdateStoreHoursInput } from "@/lib/validation";

type WizardStepBodyProps = {
  step: number;
  store: StoreDetails;
  hours: UpdateStoreHoursInput;
};

const SaveReminder = () => <p className="text-xs text-muted-foreground">Click Update to save before continuing.</p>;

export const WizardStepBody = ({ step, store, hours }: WizardStepBodyProps) => {
  switch (step) {
    case 2:
      return (
        <div className="space-y-6">
          <StoreHoursForm storeId={store.id} hours={hours} />
          <SaveReminder />
          <ClosureEditor storeId={store.id} timezone={store.timezone} />
        </div>
      );
    case 3:
      return <ResourceEditor storeId={store.id} />;
    case 4:
      return <ServiceEditor storeId={store.id} />;
    case 5:
      return (
        <div className="space-y-2">
          <StoreSettingsForm store={store} sections="rules" />
          <SaveReminder />
        </div>
      );
    case 6:
      return <PolicyEditor storeId={store.id} storeName={store.name} />;
    default:
      return <ReviewStep store={store} />;
  }
};
