"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OnboardingBasicsFields, type BasicsValues } from "@/components/admin/onboarding/OnboardingBasicsFields";
import { WizardProgress } from "@/components/admin/onboarding/WizardProgress";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/fetch-error";
import { applyTemplate } from "@/lib/onboarding/apply-template";
import { basicsFieldErrors, basicsSchema } from "@/lib/onboarding/steps";
import { WIZARD_STEPS } from "@/lib/onboarding/wizard-steps";
import { templateById } from "@/lib/templates";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import { STORE_TONE_OPTIONS } from "@/lib/validation";

const INITIAL: BasicsValues = {
  templateId: "salon",
  name: "",
  description: "",
  address: "",
  mapUrl: "",
  timezone: DEFAULT_TIMEZONE,
  contactPhone: "",
  contactEmail: "",
  ownerWhatsapp: "",
  languages: ["English"],
  tone: STORE_TONE_OPTIONS[0],
};

export const OnboardingStart = () => {
  const router = useRouter();
  const [values, setValues] = useState<BasicsValues>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof BasicsValues, string>>>({});
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const template = templateById(values.templateId);
    const parsed = basicsSchema.safeParse(values);
    if (!template || !parsed.success) {
      setErrors(basicsFieldErrors(values));
      toast.error("Check the highlighted fields.");
      return;
    }
    setErrors({});
    setBusy(true);
    const response = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed.data,
        type: template.type,
        cancellationWindowHours: template.cancellationWindowHours,
        minNoticeHours: template.minNoticeHours,
        maxDaysAhead: template.maxDaysAhead,
        autoConfirm: true,
      }),
    });
    if (!response.ok) {
      setBusy(false);
      toast.error(await errorMessage(response, "Could not create the store."));
      return;
    }
    const { store } = (await response.json()) as { store: { id: string } };
    const failures = await applyTemplate(store.id, parsed.data.name, template);
    if (failures.length > 0) {
      toast.warning(`${failures.length} template item(s) could not be added. Review them in the next steps.`);
    }
    router.push(`/admin/onboarding/${store.id}?step=2`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">New store</h1>
      <WizardProgress steps={WIZARD_STEPS} current={1} />
      <OnboardingBasicsFields values={values} errors={errors} onChange={(patch) => setValues((current) => ({ ...current, ...patch }))} />
      <Button type="button" disabled={busy} onClick={() => void create()}>
        Continue
      </Button>
    </div>
  );
};
