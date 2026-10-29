import {
  hoursStepSchema,
  policiesStepSchema,
  resourcesStepSchema,
  rulesStepSchema,
  servicesStepSchema,
  stepIssues,
} from "@/lib/onboarding/steps";

type Fetcher = (url: string) => Promise<Response>;

type StoreConfig = {
  max_days_ahead?: number;
  min_notice_hours?: number;
  cancellation_window_hours?: number;
  auto_confirm?: boolean;
};

type ServiceFacts = { name: string; isActive: boolean; requirements: { resourceType: string }[] };
type ResourceFacts = { type: string; isActive: boolean };

const CHECK_FAILED = "Could not check this step. Please try again.";

const getJson = async <T>(fetcher: Fetcher, url: string): Promise<T> => {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return (await response.json()) as T;
};

const hoursIssues = async (fetcher: Fetcher, base: string) => {
  const body = await getJson<{ hours: { days: unknown[] } }>(fetcher, `${base}/hours`);
  return stepIssues(hoursStepSchema.safeParse(body.hours));
};

const resourceIssues = async (fetcher: Fetcher, base: string) => {
  const body = await getJson<{ resources: ResourceFacts[] }>(fetcher, `${base}/resources`);
  return stepIssues(resourcesStepSchema.safeParse({ count: body.resources.filter((row) => row.isActive).length }));
};

const serviceIssues = async (fetcher: Fetcher, base: string) => {
  const [services, resources] = await Promise.all([
    getJson<{ services: ServiceFacts[] }>(fetcher, `${base}/services`),
    getJson<{ resources: ResourceFacts[] }>(fetcher, `${base}/resources`),
  ]);
  const active = services.services.filter((row) => row.isActive);
  const issues = stepIssues(servicesStepSchema.safeParse({ count: active.length }));
  for (const service of active) {
    if (service.requirements.length === 0) {
      issues.push(`${service.name} does not say which resource it needs.`);
      continue;
    }
    for (const requirement of service.requirements) {
      const available = resources.resources.some((row) => row.isActive && row.type === requirement.resourceType);
      if (!available) {
        issues.push(`${service.name} needs a ${requirement.resourceType}, but there is no active one.`);
      }
    }
  }
  return issues;
};

const ruleIssues = async (fetcher: Fetcher, base: string) => {
  const body = await getJson<{ store: { config: StoreConfig } }>(fetcher, base);
  const config = body.store.config;
  return stepIssues(
    rulesStepSchema.safeParse({
      maxDaysAhead: config.max_days_ahead,
      minNoticeHours: config.min_notice_hours,
      cancellationWindowHours: config.cancellation_window_hours,
      autoConfirm: config.auto_confirm,
    }),
  );
};

const policyIssues = async (fetcher: Fetcher, base: string) => {
  const body = await getJson<{ documents: { type: string; content: string }[] }>(fetcher, `${base}/documents`);
  const text = (type: string) => body.documents.find((row) => row.type === type)?.content ?? "";
  return stepIssues(
    policiesStepSchema.safeParse({
      privacy: text("privacy"),
      terms: text("terms"),
      cancellation: text("cancellation"),
    }),
  );
};

/** What still blocks the owner from leaving a wizard step. Reads saved data, so unsaved edits do not count. */
export const loadStepIssues = async (
  storeId: string,
  step: number,
  fetcher: Fetcher = (url) => fetch(url),
): Promise<string[]> => {
  const base = `/api/stores/${storeId}`;
  try {
    switch (step) {
      case 2:
        return await hoursIssues(fetcher, base);
      case 3:
        return await resourceIssues(fetcher, base);
      case 4:
        return await serviceIssues(fetcher, base);
      case 5:
        return await ruleIssues(fetcher, base);
      case 6:
        return await policyIssues(fetcher, base);
      default:
        return [];
    }
  } catch {
    return [CHECK_FAILED];
  }
};
