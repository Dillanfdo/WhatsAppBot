"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { StoreBasicsFields } from "@/components/admin/StoreBasicsFields";
import { StoreRulesFields } from "@/components/admin/StoreRulesFields";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  STORE_LANGUAGE_OPTIONS,
  STORE_TONE_OPTIONS,
  updateStoreSchema,
  type StoreDetails,
  type UpdateStoreInput,
} from "@/lib/validation";

type StoreSettingsFormProps = {
  store: StoreDetails;
  /** "rules" shows only booking rules (used by the onboarding wizard); other fields keep their saved values. */
  sections?: "all" | "rules";
};

const withCurrentOption = (options: readonly string[], current: string | undefined): string[] => {
  if (current && current.trim().length > 0 && !options.includes(current)) {
    return [current, ...options];
  }
  return [...options];
};

const languageOptionsFor = (stored: string[] | undefined): string[] => {
  const known: readonly string[] = STORE_LANGUAGE_OPTIONS;
  const extras = (stored ?? []).filter((language) => !known.includes(language));
  return [...STORE_LANGUAGE_OPTIONS, ...extras];
};

const slotFieldsFromMinutes = (
  minutes: number,
): Pick<UpdateStoreInput, "slotAmount" | "slotUnit"> => {
  if (minutes > 0 && minutes % 60 === 0) {
    return { slotAmount: minutes / 60, slotUnit: "hours" };
  }
  return { slotAmount: minutes, slotUnit: "min" };
};

const storeToFormValues = (store: StoreDetails): UpdateStoreInput => ({
  description: store.description ?? "",
  address: store.address ?? "",
  mapUrl: store.mapUrl ?? "",
  contactPhone: store.contactPhone ?? "",
  contactEmail: store.contactEmail ?? "",
  ownerWhatsapp: store.ownerWhatsapp ?? "",
  ...slotFieldsFromMinutes(store.slotIntervalMin),
  tone:
    store.config.tone && store.config.tone.trim().length > 0
      ? store.config.tone
      : STORE_TONE_OPTIONS[0],
  languages: store.config.languages ?? [],
  cancellationWindowHours: store.config.cancellation_window_hours ?? 0,
  minNoticeHours: store.config.min_notice_hours ?? 0,
  maxDaysAhead: store.config.max_days_ahead ?? 0,
  autoConfirm: store.config.auto_confirm ?? false,
  maxActiveBookingsPerCustomer: store.config.max_active_bookings_per_customer ?? 0,
});

export const StoreSettingsForm = ({ store, sections = "all" }: StoreSettingsFormProps) => {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<UpdateStoreInput>({
    resolver: zodResolver(updateStoreSchema),
    defaultValues: storeToFormValues(store),
  });

  const toneOptions = withCurrentOption(STORE_TONE_OPTIONS, store.config.tone);
  const languageOptions = languageOptionsFor(store.config.languages);

  const onSubmit = async (values: UpdateStoreInput) => {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Could not update the store");
        return;
      }
    } catch {
      setErrorMessage("Could not update the store");
      return;
    }

    form.reset(values);
    router.refresh();
  };

  return (
    <Form {...form}>
      <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        {sections === "all" ? (
          <StoreBasicsFields form={form} toneOptions={toneOptions} languageOptions={languageOptions} />
        ) : null}
        <StoreRulesFields form={form} />

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
          Update
        </Button>
      </form>
    </Form>
  );
};
