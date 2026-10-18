"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { StoreHoursDay } from "@/components/admin/StoreHoursDay";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  STORE_HOURS_WEEKDAYS,
  updateStoreHoursSchema,
  type UpdateStoreHoursInput,
} from "@/lib/validation";

type StoreHoursFormProps = {
  storeId: string;
  hours: UpdateStoreHoursInput;
};

export const StoreHoursForm = ({ storeId, hours }: StoreHoursFormProps) => {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<UpdateStoreHoursInput>({
    resolver: zodResolver(updateStoreHoursSchema),
    defaultValues: hours,
  });

  const onSubmit = async (values: UpdateStoreHoursInput) => {
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/stores/${storeId}/hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Could not update store hours");
        return;
      }

      const payload = (await response.json()) as { hours?: UpdateStoreHoursInput };
      const saved = updateStoreHoursSchema.safeParse(payload.hours);
      form.reset(saved.success ? saved.data : values);
    } catch {
      setErrorMessage("Could not update store hours");
      return;
    }

    router.refresh();
  };

  return (
    <Form {...form}>
      <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <p className="text-sm text-muted-foreground">
          Set opening hours for each day. Turn bookings off for walk-in days, such as weekends.
        </p>
        {STORE_HOURS_WEEKDAYS.map((day, index) => (
          <StoreHoursDay key={day.weekday} form={form} index={index} label={day.label} />
        ))}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
          Update
        </Button>
      </form>
    </Form>
  );
};
