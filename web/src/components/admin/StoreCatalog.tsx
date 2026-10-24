"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ResourceRow = { id: string; type: string; name: string; capacity: number; isActive: boolean };
type ServiceRow = {
  id: string;
  name: string;
  durationMin: number;
  bufferAfterMin: number;
  priceCents: number | null;
  minParty: number;
  maxParty: number;
  isActive: boolean;
  requirements: { resourceType: string; quantity: number }[];
};
type DocRow = { type: string; title: string; content: string; version: number };
type ExceptionRow = { id: string; startsAt: string; endsAt: string; reason: string | null };

const TYPES = ["staff", "table", "room", "console", "chair"] as const;
const DOCS = ["privacy", "terms", "cancellation", "no_show", "rules", "price_list", "faq"] as const;

const errorMessage = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } | string } | null;
  if (body && typeof body.error === "object" && body.error?.message) return body.error.message;
  if (body && typeof body.error === "string") return body.error;
  return fallback;
};

export const ReadinessPanel = ({ storeId, active, allowGoLive = true }: { storeId: string; active: boolean; allowGoLive?: boolean }) => {
  const [missing, setMissing] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(active);

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/readiness`);
    if (!response.ok) return;
    const body = (await response.json()) as { ready: boolean; missing: string[] };
    setReady(body.ready);
    setMissing(body.missing);
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const goLive = async () => {
    const response = await fetch(`/api/stores/${storeId}/activate`, { method: "POST" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Store is not ready."));
      await load();
      return;
    }
    setLive(true);
    toast.success("Store is live.");
  };

  const pause = async () => {
    const response = await fetch(`/api/stores/${storeId}/deactivate`, { method: "POST" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not pause the store."));
      return;
    }
    setLive(false);
    toast.success("Store paused.");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <div>
        <p className="font-medium">{live ? "Live" : ready ? "Ready to go live" : "Setup incomplete"}</p>
        {missing.length > 0 ? <p className="text-muted-foreground">Still needed: {missing.join(", ")}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={!ready || live || !allowGoLive} onClick={() => void goLive()}>
          Go live
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!live} onClick={() => void pause()}>
          Pause
        </Button>
      </div>
    </div>
  );
};

export const ResourceEditor = ({ storeId }: { storeId: string }) => {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("staff");
  const [capacity, setCapacity] = useState(1);

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/resources`);
    if (!response.ok) return;
    const body = (await response.json()) as { resources: ResourceRow[] };
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
      body: JSON.stringify({ name, type, capacity }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not add the resource."));
      return;
    }
    setName("");
    await load();
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/stores/${storeId}/resources/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not remove the resource."));
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2">
            <span>
              {row.name} · {row.type} · seats {row.capacity}
              {row.isActive ? "" : " · inactive"}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => void remove(row.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
        <select className="h-9 rounded-md border px-2" value={type} onChange={(event) => setType(event.target.value)}>
          {TYPES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input type="number" min={1} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} />
        <Button type="button" disabled={name.trim().length === 0} onClick={() => void add()}>
          Add resource
        </Button>
      </div>
    </div>
  );
};

export const ServiceEditor = ({ storeId }: { storeId: string }) => {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [name, setName] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);
  const [rupees, setRupees] = useState("");
  const [minParty, setMinParty] = useState(1);
  const [maxParty, setMaxParty] = useState(1);
  const [resourceType, setResourceType] = useState<string>("staff");

  const load = useCallback(async () => {
    const [serviceResponse, resourceResponse] = await Promise.all([
      fetch(`/api/stores/${storeId}/services`),
      fetch(`/api/stores/${storeId}/resources`),
    ]);
    if (serviceResponse.ok) {
      const body = (await serviceResponse.json()) as { services: ServiceRow[] };
      setRows(body.services);
    }
    if (resourceResponse.ok) {
      const body = (await resourceResponse.json()) as { resources: ResourceRow[] };
      setResources(body.resources);
    }
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const maxCapacity = Math.max(0, ...resources.filter((row) => row.type === resourceType && row.isActive).map((row) => row.capacity));

  const add = async () => {
    const response = await fetch(`/api/stores/${storeId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        durationMin,
        bufferAfterMin,
        priceCents: rupees.trim() === "" ? null : Math.round(Number(rupees) * 100),
        minParty,
        maxParty,
        requirements: [{ resourceType, quantity: 1 }],
      }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not add the service."));
      return;
    }
    setName("");
    await load();
  };

  return (
    <div className="space-y-4">
      {maxParty > maxCapacity && maxCapacity > 0 ? (
        <p className="text-sm text-amber-700">No {resourceType} can seat a party of {maxParty}.</p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id}>
            {row.name} · {row.durationMin} min · {row.priceCents === null ? "no price" : `Rs ${row.priceCents / 100}`} · party {row.minParty}-{row.maxParty}
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={name} placeholder="Service name" onChange={(event) => setName(event.target.value)} />
        <Input type="number" min={1} value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value))} />
        <Input type="number" min={0} value={bufferAfterMin} onChange={(event) => setBufferAfterMin(Number(event.target.value))} />
        <Input value={rupees} placeholder="Price in rupees" onChange={(event) => setRupees(event.target.value)} />
        <Input type="number" min={1} value={minParty} onChange={(event) => setMinParty(Number(event.target.value))} />
        <Input type="number" min={1} value={maxParty} onChange={(event) => setMaxParty(Number(event.target.value))} />
        <select className="h-9 rounded-md border px-2" value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
          {TYPES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <Button type="button" disabled={name.trim().length === 0} onClick={() => void add()}>Add service</Button>
      </div>
    </div>
  );
};

export const PolicyEditor = ({ storeId, storeName }: { storeId: string; storeName: string }) => {
  const [docs, setDocs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/documents`);
    if (!response.ok) return;
    const body = (await response.json()) as { documents: DocRow[] };
    const next: Record<string, string> = {};
    for (const document of body.documents) next[document.type] = document.content;
    setDocs(next);
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const save = async (type: string) => {
    const response = await fetch(`/api/stores/${storeId}/documents/${type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: type, content: docs[type] ?? "" }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not save the document."));
      return;
    }
    toast.success("Saved a new version.");
  };

  const fillStarter = async () => {
    const response = await fetch(`/api/stores/${storeId}/services`);
    const services = response.ok ? ((await response.json()) as { services: ServiceRow[] }).services : [];
    const notice = "SAMPLE TEXT - replace before going live. Not legal advice.";
    setDocs((current) => ({
      ...current,
      privacy: `${notice}\n\n${storeName} stores your name, phone number, and booking details so the store can manage your appointment.`,
      terms: `${notice}\n\nBy booking with ${storeName} you agree to arrive on time and to follow the store's cancellation rules.`,
      price_list: ["Prices are in INR.", ...services.map((service) => `${service.name}: ${service.priceCents === null ? "no charge" : `Rs ${service.priceCents / 100}`}`)].join("\n"),
    }));
  };

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" size="sm" onClick={() => void fillStarter()}>
        Generate starter privacy, terms, and price list
      </Button>
      {DOCS.map((type) => (
        <div key={type} className="space-y-2">
          <Label htmlFor={type}>{type}</Label>
          <Textarea id={type} value={docs[type] ?? ""} onChange={(event) => setDocs((current) => ({ ...current, [type]: event.target.value }))} />
          <Button type="button" size="sm" onClick={() => void save(type)}>Save {type}</Button>
        </div>
      ))}
    </div>
  );
};

export const ClosureEditor = ({ storeId }: { storeId: string }) => {
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
    await fetch(`/api/stores/${storeId}/exceptions/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2">
            <span>{new Date(row.startsAt).toLocaleString()} – {new Date(row.endsAt).toLocaleString()} {row.reason ?? ""}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void remove(row.id)}>Delete</Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        <Input value={reason} placeholder="Reason" onChange={(event) => setReason(event.target.value)} />
        <Button type="button" disabled={!date} onClick={() => void add()}>Add closure</Button>
      </div>
    </div>
  );
};
