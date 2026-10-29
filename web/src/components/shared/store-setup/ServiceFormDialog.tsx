"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IntakeQuestionsField } from "@/components/shared/store-setup/IntakeQuestionsField";
import { RequirementsField } from "@/components/shared/store-setup/RequirementsField";
import { ResourceRestrictionField } from "@/components/shared/store-setup/ResourceRestrictionField";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/fetch-error";
import { draftToPayload, partySizeWarnings, type ServiceDraft } from "@/lib/service-draft";
import type { StoreResource } from "@/lib/validation";

type ServiceFormDialogProps = {
  storeId: string;
  serviceId: string | null;
  initial: ServiceDraft;
  resources: StoreResource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
};

export const ServiceFormDialog = ({
  storeId,
  serviceId,
  initial,
  resources,
  open,
  onOpenChange,
  onSaved,
}: ServiceFormDialogProps) => {
  const [draft, setDraft] = useState<ServiceDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (change: Partial<ServiceDraft>) => setDraft((current) => ({ ...current, ...change }));
  const requiredTypes = draft.requirements.map((item) => item.resourceType);
  const warnings = partySizeWarnings(draft, resources);

  const save = async () => {
    const result = draftToPayload(draft);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setSaving(true);
    const response = await fetch(
      serviceId ? `/api/stores/${storeId}/services/${serviceId}` : `/api/stores/${storeId}/services`,
      {
        method: serviceId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.payload),
      },
    );
    setSaving(false);
    if (!response.ok) {
      setError(await errorMessage(response, "Could not save the service."));
      return;
    }
    toast.success(serviceId ? "Service updated." : "Service added.");
    await onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{serviceId ? "Edit service" : "Add service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="service-name">Name</Label>
            <Input id="service-name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="service-description">Description (optional)</Label>
            <Textarea
              id="service-description"
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="service-duration">Duration (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={1}
                value={draft.durationMin}
                onChange={(event) => patch({ durationMin: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-buffer">Buffer after (min)</Label>
              <Input
                id="service-buffer"
                type="number"
                min={0}
                value={draft.bufferAfterMin}
                onChange={(event) => patch({ bufferAfterMin: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-price">Price (Rs)</Label>
              <Input
                id="service-price"
                value={draft.rupees}
                placeholder="Blank = no price"
                onChange={(event) => patch({ rupees: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-min-party">Min party</Label>
              <Input
                id="service-min-party"
                type="number"
                min={1}
                value={draft.minParty}
                onChange={(event) => patch({ minParty: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="service-max-party">Max party</Label>
              <Input
                id="service-max-party"
                type="number"
                min={1}
                value={draft.maxParty}
                onChange={(event) => patch({ maxParty: Number(event.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Resources needed</Label>
            <RequirementsField value={draft.requirements} onChange={(requirements) => patch({ requirements })} />
          </div>
          <div className="space-y-1">
            <Label>Restrict to specific resources (optional)</Label>
            <ResourceRestrictionField
              resources={resources}
              requiredTypes={requiredTypes}
              value={draft.resourceIds}
              onChange={(resourceIds) => patch({ resourceIds })}
            />
          </div>
          <div className="space-y-1">
            <Label>Questions to ask the customer</Label>
            <IntakeQuestionsField value={draft.intakeQuestions} onChange={(intakeQuestions) => patch({ intakeQuestions })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.isActive} onChange={(event) => patch({ isActive: event.target.checked })} />
            Active (customers can book this service)
          </label>
          {warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-700">
              {warning}
            </p>
          ))}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
