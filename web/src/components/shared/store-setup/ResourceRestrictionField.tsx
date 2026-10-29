import type { StoreResource } from "@/lib/validation";

type ResourceRestrictionFieldProps = {
  resources: StoreResource[];
  requiredTypes: StoreResource["type"][];
  value: string[];
  onChange: (value: string[]) => void;
};

export const ResourceRestrictionField = ({ resources, requiredTypes, value, onChange }: ResourceRestrictionFieldProps) => {
  const candidates = resources.filter((resource) => requiredTypes.includes(resource.type));

  if (candidates.length === 0) {
    return <p className="text-xs text-muted-foreground">Add resources of the required types to restrict who can deliver this.</p>;
  }

  const toggle = (id: string, checked: boolean) =>
    onChange(checked ? [...value, id] : value.filter((item) => item !== id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {candidates.map((resource) => (
          <label key={resource.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(resource.id)}
              onChange={(event) => toggle(resource.id, event.target.checked)}
            />
            {resource.name}
            <span className="text-xs text-muted-foreground">({resource.type})</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length === 0 ? "None selected: any matching resource can deliver this service." : "Only the selected resources can deliver this service."}
      </p>
    </div>
  );
};
