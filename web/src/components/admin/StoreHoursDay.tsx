"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { UpdateStoreHoursInput } from "@/lib/validation";

type StoreHoursDayProps = {
  form: UseFormReturn<UpdateStoreHoursInput>;
  index: number;
  label: string;
};

export const StoreHoursDay = ({ form, index, label }: StoreHoursDayProps) => {
  const shifts = useFieldArray({
    control: form.control,
    name: `days.${index}.shifts`,
  });

  const closed = shifts.fields.length === 0;

  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      {closed ? <p className="text-sm text-muted-foreground">Closed</p> : null}
      {shifts.fields.map((shift, shiftIndex) => (
        <div key={shift.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <FormField
            control={form.control}
            name={`days.${index}.shifts.${shiftIndex}.start`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opens</FormLabel>
                <FormControl>
                  <Input {...field} type="time" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`days.${index}.shifts.${shiftIndex}.end`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Closes</FormLabel>
                <FormControl>
                  <Input {...field} type="time" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (shifts.fields.length === 1) {
                form.setValue(`days.${index}.bookable`, false, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }
              shifts.remove(shiftIndex);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => shifts.append({ start: "10:00", end: "18:00" })}
        >
          Add shift
        </Button>
        <FormField
          control={form.control}
          name={`days.${index}.bookable`}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormLabel>Bookings</FormLabel>
                <FormControl>
                  <Switch
                    checked={closed ? false : field.value}
                    disabled={closed}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  );
};
