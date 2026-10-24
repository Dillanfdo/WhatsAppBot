"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHONE_PRESETS } from "@/components/shared/chat/types";

type TestPhoneFieldProps = {
  presetId: (typeof PHONE_PRESETS)[number]["id"];
  phone: string;
  onPresetChange: (presetId: (typeof PHONE_PRESETS)[number]["id"]) => void;
  onPhoneChange: (phone: string) => void;
};

export const TestPhoneField = ({ presetId, phone, onPresetChange, onPhoneChange }: TestPhoneFieldProps) => {
  const [draft, setDraft] = useState(phone);

  return (
    <div className="space-y-2">
      <Label htmlFor="phone-preset">Customer</Label>
      <Select
        value={presetId}
        onValueChange={(value) => {
          if (value === "one" || value === "two" || value === "custom") {
            onPresetChange(value);
            if (value === "custom") {
              setDraft(phone);
            }
          }
        }}
      >
        <SelectTrigger id="phone-preset" className="w-full">
          <SelectValue placeholder="Choose a customer" />
        </SelectTrigger>
        <SelectContent>
          {PHONE_PRESETS.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.label}
              {preset.phone ? ` ${preset.phone}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {presetId === "custom" ? (
        <Input
          id="phone"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== phone) {
              onPhoneChange(draft);
            }
          }}
          placeholder="+919876543210"
        />
      ) : null}
    </div>
  );
};
