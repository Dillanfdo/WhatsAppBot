"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StoreSummary } from "@/lib/validation";

type StorePickerProps = {
  stores: StoreSummary[];
  storeId: string;
  onStoreIdChange: (storeId: string) => void;
};

export const StorePicker = ({ stores, storeId, onStoreIdChange }: StorePickerProps) => (
  <div className="space-y-2">
    <Label htmlFor="store">Store</Label>
    <Select
      value={storeId}
      onValueChange={(value) => {
        if (typeof value === "string") {
          onStoreIdChange(value);
        }
      }}
    >
      <SelectTrigger id="store" className="w-full">
        <SelectValue placeholder="Select a store" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
            {store.isActive ? "" : " (Draft)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {stores.find((store) => store.id === storeId && !store.isActive) ? (
      <Badge variant="outline">Draft</Badge>
    ) : null}
  </div>
);
