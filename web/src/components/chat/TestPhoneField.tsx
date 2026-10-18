"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TestPhoneFieldProps = {
  phone: string;
  onPhoneChange: (phone: string) => void;
};

export const TestPhoneField = ({ phone, onPhoneChange }: TestPhoneFieldProps) => (
  <div className="space-y-2">
    <Label htmlFor="phone">Test phone number</Label>
    <Input
      id="phone"
      value={phone}
      onChange={(event) => onPhoneChange(event.target.value)}
    />
  </div>
);
