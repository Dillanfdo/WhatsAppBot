"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/fetch-error";
import type { ServiceRow as ServiceRecord } from "@/lib/store-setup-types";
import type { StoreResource } from "@/lib/validation";

type ServiceRowProps = {
  storeId: string;
  service: ServiceRecord;
  resources: StoreResource[];
  onEdit: () => void;
  onChanged: () => Promise<void>;
};

const priceLabel = (priceCents: number | null): string => (priceCents === null ? "no price" : `Rs ${priceCents / 100}`);

export const ServiceRow = ({ storeId, service, resources, onEdit, onChanged }: ServiceRowProps) => {
  const needs = service.requirements.map((item) => `${item.quantity} ${item.resourceType}`).join(" + ");
  const restricted = service.resourceIds
    .map((id) => resources.find((resource) => resource.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const setActive = async (isActive: boolean) => {
    const response = await fetch(`/api/stores/${storeId}/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not update the service."));
      return;
    }
    await onChanged();
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <div className={service.isActive ? "" : "text-muted-foreground"}>
        <p>
          {service.name} · {service.durationMin} min · {priceLabel(service.priceCents)} · party {service.minParty}-
          {service.maxParty}
          {service.isActive ? "" : " · inactive"}
        </p>
        <p className="text-xs text-muted-foreground">
          Needs {needs || "no resources"}
          {restricted.length > 0 ? ` · only ${restricted.join(", ")}` : ""}
          {service.intakeQuestions.length > 0 ? ` · ${service.intakeQuestions.length} question(s)` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Active
          <Switch
            checked={service.isActive}
            onCheckedChange={(checked) => void setActive(checked)}
            aria-label={`Toggle ${service.name}`}
          />
        </label>
        <Button type="button" size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
      </div>
    </li>
  );
};
