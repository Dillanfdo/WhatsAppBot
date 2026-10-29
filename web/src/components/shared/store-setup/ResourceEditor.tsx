"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CsvImportPanel } from "@/components/shared/store-setup/CsvImportPanel";
import { ResourceRow } from "@/components/shared/store-setup/ResourceRow";
import { ResourceTypeSelect } from "@/components/shared/store-setup/ResourceTypeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/fetch-error";
import { parseResourcesCsv, type CsvResourceRow } from "@/lib/onboarding/csv";
import type { StoreResource } from "@/lib/validation";

export const ResourceEditor = ({ storeId }: { storeId: string }) => {
  const [rows, setRows] = useState<StoreResource[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<StoreResource["type"]>("staff");
  const [capacity, setCapacity] = useState(1);

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/resources`);
    if (!response.ok) return;
    const body = (await response.json()) as { resources: StoreResource[] };
    setRows(body.resources);
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const add = async () => {
    const response = await fetch(`/api/stores/${storeId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type, capacity }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not add the resource."));
      return;
    }
    setName("");
    await load();
  };

  const importRow = async (row: CsvResourceRow) => {
    const response = await fetch(`/api/stores/${storeId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    return response.ok ? null : errorMessage(response, `Could not add ${row.name}.`);
  };

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No resources yet. Add the staff, tables or rooms customers book.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <ResourceRow key={row.id} storeId={storeId} resource={row} onChanged={load} />
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <Input aria-label="Name" value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
        <ResourceTypeSelect value={type} onChange={setType} />
        <Input
          aria-label="Capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(event) => setCapacity(Number(event.target.value))}
        />
        <Button type="button" disabled={name.trim().length === 0 || capacity < 1} onClick={() => void add()}>
          Add resource
        </Button>
      </div>
      <CsvImportPanel
        label="Import resources from CSV"
        columns="name, type, capacity"
        parse={parseResourcesCsv}
        importRow={importRow}
        onDone={load}
      />
    </div>
  );
};
