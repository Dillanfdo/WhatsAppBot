"use client";

import type { UseFormReturn } from "react-hook-form";
import { StoreSettingsNumberField } from "@/components/admin/StoreSettingsNumberField";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { UpdateStoreInput } from "@/lib/validation";

type StoreRulesFieldsProps = {
  form: UseFormReturn<UpdateStoreInput>;
};

const NUMBER_FIELDS = [
  { name: "cancellationWindowHours", label: "Cancellation window (hours before the booking)" },
  { name: "minNoticeHours", label: "Minimum notice (hours)" },
  { name: "maxDaysAhead", label: "Book up to (days ahead)" },
  { name: "maxActiveBookingsPerCustomer", label: "Max active bookings per customer (0 = no limit)" },
] as const satisfies readonly { name: keyof UpdateStoreInput; label: string }[];

export const StoreRulesFields = ({ form }: StoreRulesFieldsProps) => (
  <>
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
          <FormDescription>
            On: bookings are confirmed instantly. Off: they wait for you to confirm them on the Bookings page.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </>
);
