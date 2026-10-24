"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StoreSummary } from "@/lib/validation";
import { storeListResponseSchema } from "@/lib/validation";

type BookingRow = {
  id: string;
  storeId: string;
  status: string;
  serviceName: string;
  localLabel: string;
  partySize: number;
  price: string;
  resourceNames: string[];
  customerPhone: string;
  customerName: string | null;
};

const PAGE = 20;

const statusVariant = (status: string) => {
  if (status === "confirmed") return "secondary" as const;
  if (status === "held") return "outline" as const;
  if (status === "cancelled") return "destructive" as const;
  return "ghost" as const;
};

export const BookingsBoard = () => {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [storeId, setStoreId] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [pendingCancel, setPendingCancel] = useState<BookingRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [draft, setDraft] = useState({
    serviceId: "",
    customerPhone: "+919999900001",
    customerName: "",
    date: "",
    time: "10:00",
    partySize: "1",
  });

  const load = async (nextPage = page) => {
    const params = new URLSearchParams();
    if (storeId !== "all") params.set("storeId", storeId);
    if (status !== "all") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (phone.trim()) params.set("phone", phone.trim());
    params.set("limit", String(PAGE));
    params.set("offset", String(nextPage * PAGE));
    const response = await fetch(`/api/bookings?${params.toString()}`);
    if (!response.ok) {
      toast.error("Could not load bookings");
      return;
    }
    const body = (await response.json()) as { bookings: BookingRow[]; total: number };
    setRows(body.bookings);
    setTotal(body.total);
  };

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/stores");
      const parsed = storeListResponseSchema.safeParse(await response.json());
      if (parsed.success) {
        setStores(parsed.data.stores);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const run = async () => {
      await load(page);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, status, from, to, page]);

  useEffect(() => {
    if (!adding || storeId === "all") {
      return;
    }
    const run = async () => {
      const response = await fetch(`/api/stores/${storeId}/services`);
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { services: { id: string; name: string }[] };
      setServices(body.services);
      setDraft((current) => ({ ...current, serviceId: current.serviceId || body.services[0]?.id || "" }));
    };
    void run();
  }, [adding, storeId]);

  const cancel = async () => {
    if (!pendingCancel) {
      return;
    }
    const response = await fetch(`/api/bookings/${pendingCancel.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: pendingCancel.storeId }),
    });
    if (!response.ok) {
      toast.error("Cancel failed");
      return;
    }
    toast.success("Booking cancelled");
    setPendingCancel(null);
    await load();
  };

  const confirm = async (row: BookingRow) => {
    const response = await fetch(`/api/bookings/${row.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: row.storeId }),
    });
    if (!response.ok) {
      toast.error("Confirm failed");
      return;
    }
    toast.success("Booking confirmed");
    await load();
  };

  const addBooking = async () => {
    if (storeId === "all") {
      toast.error("Choose one store first");
      return;
    }
    const response = await fetch(`/api/stores/${storeId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: draft.serviceId,
        customerPhone: draft.customerPhone,
        customerName: draft.customerName || undefined,
        startsAt: `${draft.date}T${draft.time}:00`,
        partySize: Number(draft.partySize),
      }),
    });
    const body = (await response.json()) as { error?: { message: string } };
    if (!response.ok) {
      toast.error(body.error?.message ?? "Could not add the booking");
      return;
    }
    toast.success("Booking added");
    setAdding(false);
    await load(0);
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bookings</h1>
          <p className="text-sm text-muted-foreground">{total} bookings</p>
        </div>
        <Button type="button" onClick={() => setAdding(true)} disabled={storeId === "all"}>
          Add booking
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Select value={storeId} onValueChange={(value) => { if (typeof value === "string") { setPage(0); setStoreId(value); } }}>
          <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => { if (typeof value === "string") { setPage(0); setStatus(value); } }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {["all", "held", "confirmed", "cancelled", "completed", "no_show"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(event) => { setPage(0); setFrom(event.target.value); }} />
        <Input type="date" value={to} onChange={(event) => { setPage(0); setTo(event.target.value); }} />
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onBlur={() => { setPage(0); void load(0); }}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Party</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">No bookings match these filters.</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div>{row.customerName ?? "Customer"}</div>
                  <div className="text-xs text-muted-foreground">{row.customerPhone}</div>
                </TableCell>
                <TableCell>{row.serviceName}</TableCell>
                <TableCell>{row.localLabel}</TableCell>
                <TableCell>{row.partySize}</TableCell>
                <TableCell>{row.resourceNames.join(", ") || "—"}</TableCell>
                <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                <TableCell className="space-x-2 text-right">
                  {row.status === "held" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void confirm(row)}>Confirm</Button>
                  ) : null}
                  {row.status === "held" || row.status === "confirmed" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPendingCancel(row)}>Cancel</Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between text-sm">
        <Button type="button" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
        <span>Page {page + 1}</span>
        <Button type="button" variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
      </div>
      <Dialog open={pendingCancel !== null} onOpenChange={(open) => { if (!open) setPendingCancel(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel this booking?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{pendingCancel?.localLabel} · {pendingCancel?.serviceName}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingCancel(null)}>Keep</Button>
            <Button type="button" onClick={() => void cancel()}>Cancel booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add booking</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Service</Label>
              <Select value={draft.serviceId} onValueChange={(value) => { if (typeof value === "string") setDraft((current) => ({ ...current, serviceId: value })); }}>
                <SelectTrigger><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={draft.customerPhone} onChange={(event) => setDraft((current) => ({ ...current, customerPhone: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={draft.customerName} onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
              <Input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Party size</Label>
              <Input value={draft.partySize} onChange={(event) => setDraft((current) => ({ ...current, partySize: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void addBooking()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
