"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClosureEditor, PolicyEditor, ReadinessPanel, ResourceEditor, ServiceEditor } from "@/components/admin/StoreCatalog";
import { StoreHoursForm } from "@/components/admin/StoreHoursForm";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { EmbeddedChat } from "@/components/shared/chat/EmbeddedChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hoursFromTemplate, templateById, templates } from "@/lib/templates";
import { starterPrivacy, starterTerms, cancellationFromRules } from "@/lib/policies";
import { basicsSchema } from "@/lib/onboarding/steps";
import type { StoreDetails, UpdateStoreHoursInput } from "@/lib/validation";

const STEPS = ["Basics", "Hours", "Resources", "Services", "Rules", "Policies", "Review"];

export const OnboardingStart = () => {
  const router = useRouter();
  const [templateId, setTemplateId] = useState("salon");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const template = templateById(templateId);
    if (!template) return;
    const parsed = basicsSchema.safeParse({ name, timezone: "Asia/Kolkata", contactPhone: phone, address });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: parsed.data.name,
        type: template.type,
        timezone: "Asia/Kolkata",
        address: parsed.data.address,
        contactPhone: parsed.data.contactPhone,
        cancellationWindowHours: template.cancellationWindowHours,
        minNoticeHours: template.minNoticeHours,
        maxDaysAhead: template.maxDaysAhead,
        autoConfirm: false,
      }),
    });
    if (!response.ok) {
      setBusy(false);
      toast.error("Could not create the store.");
      return;
    }
    const body = (await response.json()) as { store: { id: string } };
    const storeId = body.store.id;
    await fetch(`/api/stores/${storeId}/hours`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hoursFromTemplate(template)),
    });
    for (const resource of template.resources) {
      await fetch(`/api/stores/${storeId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resource),
      });
    }
    for (const service of template.services) {
      await fetch(`/api/stores/${storeId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: service.name,
          durationMin: service.durationMin,
          bufferAfterMin: service.bufferAfterMin,
          priceCents: service.priceRupees === null ? null : service.priceRupees * 100,
          minParty: service.minParty,
          maxParty: service.maxParty,
          requirements: service.requirements,
        }),
      });
    }
    const noticeDocs = [
      ["privacy", starterPrivacy(parsed.data.name)],
      ["terms", starterTerms(parsed.data.name)],
      ["cancellation", cancellationFromRules(template.cancellationWindowHours)],
    ] as const;
    for (const [type, content] of noticeDocs) {
      await fetch(`/api/stores/${storeId}/documents/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: type, content }),
      });
    }
    router.push(`/admin/onboarding/${storeId}?step=2`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">New store</h1>
      <Label>Template</Label>
      <select className="h-9 w-full rounded-md border px-2" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>{template.label}</option>
        ))}
      </select>
      <Label htmlFor="store-name">Name</Label>
      <Input id="store-name" value={name} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor="store-phone">Contact phone</Label>
      <Input id="store-phone" value={phone} placeholder="+919876543210" onChange={(event) => setPhone(event.target.value)} />
      <Label htmlFor="store-address">Address</Label>
      <Input id="store-address" value={address} onChange={(event) => setAddress(event.target.value)} />
      <Button type="button" disabled={busy} onClick={() => void create()}>Continue</Button>
    </div>
  );
};

export const OnboardingResume = ({
  store,
  hours,
  step,
}: {
  store: StoreDetails;
  hours: UpdateStoreHoursInput;
  step: number;
}) => {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const current = Math.min(Math.max(step, 2), 7);

  const go = (next: number) => {
    router.push(`/admin/onboarding/${store.id}?step=${next}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Step {current} of 7 · {STEPS[current - 1]} · {store.name}</p>
      {current === 2 ? <><StoreHoursForm storeId={store.id} hours={hours} /><ClosureEditor storeId={store.id} /></> : null}
      {current === 3 ? <ResourceEditor storeId={store.id} /> : null}
      {current === 4 ? <ServiceEditor storeId={store.id} /> : null}
      {current === 5 ? <StoreSettingsForm store={store} /> : null}
      {current === 6 ? <PolicyEditor storeId={store.id} storeName={store.name} /> : null}
      {current === 7 ? (
        <div className="space-y-4">
          <ReadinessPanel storeId={store.id} active={store.isActive} allowGoLive={confirmed} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            I checked the hours, services, and policies.
          </label>
          <EmbeddedChat storeId={store.id} storeName={store.name} />
          {!confirmed ? <p className="text-sm text-muted-foreground">Confirm the checklist before going live.</p> : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        {current > 2 ? <Button type="button" variant="outline" onClick={() => go(current - 1)}>Back</Button> : null}
        {current < 7 ? <Button type="button" onClick={() => go(current + 1)}>Next</Button> : null}
      </div>
    </div>
  );
};
