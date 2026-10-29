"use client";

import type { UseFormReturn } from "react-hook-form";
import { StoreSettingsNumberField } from "@/components/admin/StoreSettingsNumberField";
import {
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
import { Textarea } from "@/components/ui/textarea";
import type { UpdateStoreInput } from "@/lib/validation";

type StoreBasicsFieldsProps = {
  form: UseFormReturn<UpdateStoreInput>;
  toneOptions: string[];
  languageOptions: string[];
};

export const StoreBasicsFields = ({ form, toneOptions, languageOptions }: StoreBasicsFieldsProps) => (
  <>
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
  </>
);
