"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ResourceTypeSelect } from "@/components/shared/store-setup/ResourceTypeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/fetch-error";
import type { StoreResource } from "@/lib/validation";

type ResourceRowProps = {
  storeId: string;
  resource: StoreResource;
  onChanged: () => Promise<void>;
};

export const ResourceRow = ({ storeId, resource, onChanged }: ResourceRowProps) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(resource.name);
  const [type, setType] = useState(resource.type);
  const [capacity, setCapacity] = useState(resource.capacity);

  const patch = async (body: Partial<Pick<StoreResource, "name" | "type" | "capacity" | "isActive">>) => {
    const response = await fetch(`/api/stores/${storeId}/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not update the resource."));
      return false;
    }
    await onChanged();
    return true;
  };

  const save = async () => {
    if (await patch({ name: name.trim(), type, capacity })) {
      setEditing(false);
    }
  };

  const cancelEdit = () => {
    setName(resource.name);
    setType(resource.type);
    setCapacity(resource.capacity);
    setEditing(false);
  };

  const remove = async () => {
    const response = await fetch(`/api/stores/${storeId}/resources/${resource.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not remove the resource."));
      return;
    }
    const body = (await response.json().catch(() => null)) as { deactivated?: boolean } | null;
    if (body?.deactivated) {
      toast.info("This resource has bookings, so it was deactivated instead of deleted.");
    }
    await onChanged();
  };

  if (editing) {
    return (
      <li className="grid gap-2 sm:grid-cols-[1fr_auto_6rem_auto]">
        <Input aria-label="Resource name" value={name} onChange={(event) => setName(event.target.value)} />
        <ResourceTypeSelect value={type} onChange={setType} />
        <Input
          aria-label="Capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(event) => setCapacity(Number(event.target.value))}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={name.trim().length === 0 || capacity < 1} onClick={() => void save()}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span className={resource.isActive ? "" : "text-muted-foreground"}>
        {resource.name} · {resource.type} · seats {resource.capacity}
        {resource.isActive ? "" : " · inactive"}
      </span>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Active
          <Switch
            checked={resource.isActive}
            onCheckedChange={(checked) => void patch({ isActive: checked })}
            aria-label={`Toggle ${resource.name}`}
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void remove()}>
          Remove
        </Button>
      </div>
    </li>
  );
};
