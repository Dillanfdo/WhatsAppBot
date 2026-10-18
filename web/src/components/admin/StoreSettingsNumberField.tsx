"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { UpdateStoreInput } from "@/lib/validation";

type StoreSettingsNumberFieldProps = {
  form: UseFormReturn<UpdateStoreInput>;
  name:
    | "slotAmount"
    | "cancellationWindowHours"
    | "minNoticeHours"
    | "maxDaysAhead"
    | "maxActiveBookingsPerCustomer";
  label: string;
  min: number;
};

export const StoreSettingsNumberField = ({
  form,
  name,
  label,
  min,
}: StoreSettingsNumberFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input
            type="number"
            min={min}
            step={1}
            name={field.name}
            ref={field.ref}
            value={Number.isFinite(field.value) ? field.value : ""}
            onBlur={field.onBlur}
            onChange={(event) => {
              field.onChange(event.target.value === "" ? Number.NaN : event.target.valueAsNumber);
            }}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);
