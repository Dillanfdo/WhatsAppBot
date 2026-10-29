import { RESOURCE_TYPES } from "@/lib/store-setup-types";
import type { StoreResource } from "@/lib/validation";

type ResourceTypeSelectProps = {
  value: StoreResource["type"];
  onChange: (value: StoreResource["type"]) => void;
  id?: string;
  label?: string;
};

export const ResourceTypeSelect = ({ value, onChange, id, label = "Resource type" }: ResourceTypeSelectProps) => (
  <select
    id={id}
    aria-label={label}
    className="h-9 rounded-md border px-2"
    value={value}
    onChange={(event) => {
      const next = RESOURCE_TYPES.find((item) => item === event.target.value);
      if (next) {
        onChange(next);
      }
    }}
  >
    {RESOURCE_TYPES.map((item) => (
      <option key={item} value={item}>
        {item}
      </option>
    ))}
  </select>
);
