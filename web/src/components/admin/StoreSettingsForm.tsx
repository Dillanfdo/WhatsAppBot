"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { StoreSettingsNumberField } from "@/components/admin/StoreSettingsNumberField";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  STORE_LANGUAGE_OPTIONS,
  STORE_TONE_OPTIONS,
  updateStoreSchema,
  type StoreDetails,
  type UpdateStoreInput,
} from "@/lib/validation";

type StoreSettingsFormProps = {
  store: StoreDetails;
};

const NUMBER_FIELDS = [
  { name: "cancellationWindowHours", label: "Cancellation window (hours)" },
  { name: "minNoticeHours", label: "Min notice (hours)" },
  { name: "maxDaysAhead", label: "Max days ahead" },
  { name: "maxActiveBookingsPerCustomer", label: "Max active bookings per customer" },
] as const satisfies readonly { name: keyof UpdateStoreInput; label: string }[];

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

export const StoreSettingsForm = ({ store }: StoreSettingsFormProps) => {
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
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mapUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Map URL</FormLabel>
              <FormControl>
                <Input {...field} inputMode="url" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact phone</FormLabel>
              <FormControl>
                <Input {...field} inputMode="tel" placeholder="+919876543210" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact email</FormLabel>
              <FormControl>
                <Input {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ownerWhatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <Input {...field} inputMode="tel" placeholder="+919876543210" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-end">
          <StoreSettingsNumberField form={form} name="slotAmount" label="Slot interval" min={1} />
          <FormField
            control={form.control}
            name="slotUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value === "min" || value === "hours") {
                      field.onChange(value);
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="min">min</SelectItem>
                    <SelectItem value="hours">hours</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="languages"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Languages</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-4">
                  {languageOptions.map((language) => (
                    <label key={language} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={field.value.includes(language)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...field.value, language]
                            : field.value.filter((item) => item !== language);
                          field.onChange(next);
                        }}
                      />
                      {language}
                    </label>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {NUMBER_FIELDS.map((item) => (
          <StoreSettingsNumberField key={item.name} form={form} name={item.name} label={item.label} min={0} />
        ))}

        <FormField
          control={form.control}
          name="autoConfirm"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-3">
                <FormLabel>Auto confirm</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tone</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (value) {
                    field.onChange(value);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {toneOptions.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
          Update
        </Button>
      </form>
    </Form>
  );
};
