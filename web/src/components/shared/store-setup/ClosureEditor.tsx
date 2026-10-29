"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/fetch-error";
import type { ExceptionRow } from "@/lib/store-setup-types";
import { DEFAULT_TIMEZONE, formatClosureRange } from "@/lib/time";

type ClosureEditorProps = {
  storeId: string;
  timezone?: string;
};

export const ClosureEditor = ({ storeId, timezone = DEFAULT_TIMEZONE }: ClosureEditorProps) => {
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/exceptions`);
    if (!response.ok) return;
    const body = (await response.json()) as { exceptions: ExceptionRow[] };
    setRows(body.exceptions);
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const add = async () => {
    const response = await fetch(`/api/stores/${storeId}/exceptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        endDate: endDate || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        reason: reason || undefined,
      }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not add the closure."));
      return;
    }
    setReason("");
    await load();
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/stores/${storeId}/exceptions/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not delete the closure."));
      return;
    }
    await load();
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Closures</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No closures. Add holidays or planned breaks below.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <span>
                {formatClosureRange(row.startsAt, row.endsAt, timezone)}
                {row.reason ? ` · ${row.reason}` : ""}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => void remove(row.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="closure-date">From date</Label>
          <Input id="closure-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="closure-end-date">To date (optional)</Label>
          <Input id="closure-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="closure-reason">Reason (optional)</Label>
          <Input id="closure-reason" value={reason} placeholder="Public holiday" onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="closure-start-time">From time (optional)</Label>
          <Input id="closure-start-time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="closure-end-time">To time (optional)</Label>
          <Input id="closure-end-time" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" disabled={!date} onClick={() => void add()}>
            Add closure
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Leave the times blank to close the whole day. Times are in {timezone}.</p>
    </div>
  );
};
