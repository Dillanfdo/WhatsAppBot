"use client";

import { useCallback, useEffect, useState } from "react";
import { CsvImportPanel } from "@/components/shared/store-setup/CsvImportPanel";
import { ResourceTypeSelect } from "@/components/shared/store-setup/ResourceTypeSelect";
import { ServiceFormDialog } from "@/components/shared/store-setup/ServiceFormDialog";
import { ServiceRow } from "@/components/shared/store-setup/ServiceRow";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/fetch-error";
import { parseServicesCsv } from "@/lib/onboarding/csv";
import { draftFromService, emptyServiceDraft, type ServiceDraft } from "@/lib/service-draft";
import type { ServiceRow as ServiceRecord } from "@/lib/store-setup-types";
import type { ServiceWriteInput, StoreResource } from "@/lib/validation";

type Editing = { serviceId: string | null; draft: ServiceDraft };

export const ServiceEditor = ({ storeId }: { storeId: string }) => {
  const [rows, setRows] = useState<ServiceRecord[]>([]);
  const [resources, setResources] = useState<StoreResource[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [csvType, setCsvType] = useState<StoreResource["type"]>("staff");

  const load = useCallback(async () => {
    const [serviceResponse, resourceResponse] = await Promise.all([
      fetch(`/api/stores/${storeId}/services`),
      fetch(`/api/stores/${storeId}/resources`),
    ]);
    if (serviceResponse.ok) {
      const body = (await serviceResponse.json()) as { services: ServiceRecord[] };
      setRows(body.services);
    }
    if (resourceResponse.ok) {
      const body = (await resourceResponse.json()) as { resources: StoreResource[] };
      setResources(body.resources);
    }
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const open = (next: Editing) => {
    setDialogKey((value) => value + 1);
    setEditing(next);
  };

  const importRow = async (row: ServiceWriteInput) => {
    const response = await fetch(`/api/stores/${storeId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return response.ok ? null : errorMessage(response, `Could not add ${row.name}.`);
  };

  const defaultType = resources.find((resource) => resource.isActive)?.type ?? "staff";

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No services yet. Add what customers can book.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {rows.map((row) => (
            <ServiceRow
              key={row.id}
              storeId={storeId}
              service={row}
              resources={resources}
              onEdit={() => open({ serviceId: row.id, draft: draftFromService(row) })}
              onChanged={load}
            />
          ))}
        </ul>
      )}
      <Button type="button" onClick={() => open({ serviceId: null, draft: emptyServiceDraft(defaultType) })}>
        Add service
      </Button>
      <CsvImportPanel
        label="Import services from CSV"
        columns="name, duration, price (optional), buffer (optional)"
        parse={(text) => parseServicesCsv(text, csvType)}
        importRow={importRow}
        onDone={load}
      >
        <label className="flex items-center gap-2 text-sm">
          Resource every imported service needs
          <ResourceTypeSelect value={csvType} onChange={setCsvType} label="Resource type for imported services" />
        </label>
      </CsvImportPanel>
      {editing ? (
        <ServiceFormDialog
          key={dialogKey}
          storeId={storeId}
          serviceId={editing.serviceId}
          initial={editing.draft}
          resources={resources}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          onSaved={load}
        />
      ) : null}
    </div>
  );
};
