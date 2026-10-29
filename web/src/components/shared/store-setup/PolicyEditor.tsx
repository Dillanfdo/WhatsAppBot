"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PolicyField } from "@/components/shared/store-setup/PolicyField";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/fetch-error";
import { cancellationFromRules, priceListFromServices, starterPrivacy, starterTerms } from "@/lib/policies";
import { DOCUMENT_TYPES, type DocRow, type DocumentType, type ServiceRow } from "@/lib/store-setup-types";

type PolicyEditorProps = {
  storeId: string;
  storeName: string;
};

export const PolicyEditor = ({ storeId, storeName }: PolicyEditorProps) => {
  const [saved, setSaved] = useState<Record<string, DocRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/stores/${storeId}/documents`);
    if (!response.ok) return;
    const body = (await response.json()) as { documents: DocRow[] };
    const rows: Record<string, DocRow> = {};
    const texts: Record<string, string> = {};
    for (const document of body.documents) {
      rows[document.type] = document;
      texts[document.type] = document.content;
    }
    setSaved(rows);
    setDrafts((current) => ({ ...texts, ...unsavedOnly(current, rows) }));
  }, [storeId]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const save = async (type: DocumentType) => {
    const response = await fetch(`/api/stores/${storeId}/documents/${type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: type, content: drafts[type] ?? "" }),
    });
    if (!response.ok) {
      toast.error(await errorMessage(response, "Could not save the document."));
      return;
    }
    toast.success("Saved a new version.");
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== type)));
    await load();
  };

  const fillNotices = () =>
    setDrafts((current) => ({
      ...current,
      privacy: starterPrivacy(storeName),
      terms: starterTerms(storeName),
    }));

  const fillCancellation = async () => {
    const response = await fetch(`/api/stores/${storeId}`);
    const body = response.ok ? ((await response.json()) as { store: { config: { cancellation_window_hours?: number } } }) : null;
    const hours = body?.store.config.cancellation_window_hours;
    if (hours === undefined) {
      toast.error("Set the cancellation window under General first.");
      return;
    }
    setDrafts((current) => ({ ...current, cancellation: cancellationFromRules(hours) }));
  };

  const fillPriceList = async () => {
    const response = await fetch(`/api/stores/${storeId}/services`);
    const services = response.ok ? ((await response.json()) as { services: ServiceRow[] }).services : [];
    const active = services.filter((service) => service.isActive);
    if (active.length === 0) {
      toast.error("Add a service first.");
      return;
    }
    setDrafts((current) => ({ ...current, price_list: priceListFromServices(active) }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={fillNotices}>
          Starter privacy and terms
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void fillCancellation()}>
          Cancellation from my rules
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void fillPriceList()}>
          Price list from services
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Starter text is a placeholder, not legal advice. Review it before going live. Saving creates a new version.
      </p>
      {DOCUMENT_TYPES.map((type) => (
        <PolicyField
          key={type}
          type={type}
          saved={saved[type]}
          value={drafts[type] ?? ""}
          onChange={(value) => setDrafts((current) => ({ ...current, [type]: value }))}
          onSave={() => void save(type)}
        />
      ))}
    </div>
  );
};

/** Keeps text the owner typed or generated but has not saved, so a reload never wipes it. */
const unsavedOnly = (drafts: Record<string, string>, saved: Record<string, DocRow>): Record<string, string> => {
  const kept: Record<string, string> = {};
  for (const [type, text] of Object.entries(drafts)) {
    if (text.trim() !== (saved[type]?.content ?? "").trim()) {
      kept[type] = text;
    }
  }
  return kept;
};
