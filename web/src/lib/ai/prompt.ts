import "server-only";

export type PromptBusiness = {
  name: string;
  timezone: string;
};

export function buildSystemPrompt(business: PromptBusiness, now: Date): string {
  // TODO: inject services, policies, opening hours, and tool usage rules
  return [
    `You are a booking assistant for ${business.name}.`,
    `Business timezone: ${business.timezone}.`,
    `Current time: ${now.toISOString()}.`,
    "Never invent a business_id or customer identity; the server provides those.",
  ].join(" ");
}
