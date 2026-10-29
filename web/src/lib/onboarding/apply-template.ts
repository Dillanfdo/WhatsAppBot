import { errorMessage } from "@/lib/fetch-error";
import {
  cancellationFromRules,
  priceListFromServices,
  starterPrivacy,
  starterTerms,
} from "@/lib/policies";
import { hoursFromTemplate, type StoreTemplate } from "@/lib/templates";

const send = async (url: string, method: "PATCH" | "POST" | "PUT", body: unknown): Promise<string | null> => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.ok ? null : errorMessage(response, `${method} ${url} failed`);
};

/** Fills a new store with a template's hours, resources, services and starter policies. Returns what failed. */
export const applyTemplate = async (storeId: string, storeName: string, template: StoreTemplate): Promise<string[]> => {
  const base = `/api/stores/${storeId}`;
  const priceList = priceListFromServices(
    template.services.map((service) => ({
      name: service.name,
      durationMin: service.durationMin,
      priceCents: service.priceRupees === null ? null : service.priceRupees * 100,
    })),
  );

  const documents = [
    ["privacy", starterPrivacy(storeName)],
    ["terms", starterTerms(storeName)],
    ["cancellation", cancellationFromRules(template.cancellationWindowHours)],
    ...(template.services.length > 0 ? [["price_list", priceList] as const] : []),
  ] as const;

  const results = await Promise.all([
    send(`${base}/hours`, "PATCH", hoursFromTemplate(template)),
    ...template.resources.map((resource) => send(`${base}/resources`, "POST", resource)),
    ...template.services.map((service) =>
      send(`${base}/services`, "POST", {
        name: service.name,
        durationMin: service.durationMin,
        bufferAfterMin: service.bufferAfterMin,
        priceCents: service.priceRupees === null ? null : service.priceRupees * 100,
        minParty: service.minParty,
        maxParty: service.maxParty,
        requirements: service.requirements,
      }),
    ),
    ...documents.map(([type, content]) => send(`${base}/documents/${type}`, "PUT", { title: type, content })),
  ]);

  return results.filter((message): message is string => message !== null);
};
