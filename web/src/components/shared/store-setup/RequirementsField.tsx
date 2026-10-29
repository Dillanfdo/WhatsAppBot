import { ResourceTypeSelect } from "@/components/shared/store-setup/ResourceTypeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceDraft } from "@/lib/service-draft";

type RequirementsFieldProps = {
  value: ServiceDraft["requirements"];
  onChange: (value: ServiceDraft["requirements"]) => void;
};

export const RequirementsField = ({ value, onChange }: RequirementsFieldProps) => {
  const update = (index: number, patch: Partial<ServiceDraft["requirements"][number]>) =>
    onChange(value.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      {value.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ResourceTypeSelect
            label={`Required resource type ${index + 1}`}
            value={item.resourceType}
            onChange={(resourceType) => update(index, { resourceType })}
          />
          <Input
            aria-label={`Quantity ${index + 1}`}
            className="w-20"
            type="number"
            min={1}
            value={item.quantity}
            onChange={(event) => update(index, { quantity: Number(event.target.value) })}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={value.length <= 1}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange([...value, { resourceType: "chair", quantity: 1 }])}
      >
        Add another type
      </Button>
      <p className="text-xs text-muted-foreground">
        A booking needs every listed type at once, for example a dentist (staff) and a chair.
      </p>
    </div>
  );
};
