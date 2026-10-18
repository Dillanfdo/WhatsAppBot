"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DUMMY_STORES } from "@/components/chat/dummyStores";

type StorePickerProps = {
  storeId: string;
  onStoreIdChange: (storeId: string) => void;
};

export const StorePicker = ({ storeId, onStoreIdChange }: StorePickerProps) => (
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
        {DUMMY_STORES.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
