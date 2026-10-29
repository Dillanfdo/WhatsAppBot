"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardProgress } from "@/components/admin/onboarding/WizardProgress";
import { WizardStepBody } from "@/components/admin/onboarding/WizardStepBody";
import { Button } from "@/components/ui/button";
import { loadStepIssues } from "@/lib/onboarding/step-gate";
import { clampStep, WIZARD_STEPS } from "@/lib/onboarding/wizard-steps";
import type { StoreDetails, UpdateStoreHoursInput } from "@/lib/validation";

type OnboardingResumeProps = {
  store: StoreDetails;
  hours: UpdateStoreHoursInput;
  step: number;
};

export const OnboardingResume = ({ store, hours, step }: OnboardingResumeProps) => {
  const router = useRouter();
  const current = clampStep(step);
  const [issues, setIssues] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const go = (next: number) => {
    setIssues([]);
    router.push(`/admin/onboarding/${store.id}?step=${next}`);
  };

  const next = async () => {
    setChecking(true);
    const found = await loadStepIssues(store.id, current);
    setChecking(false);
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    go(current + 1);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{store.name}</p>
      <WizardProgress steps={WIZARD_STEPS} current={current} />
      <WizardStepBody step={current} store={store} hours={hours} />
      {issues.length > 0 ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">Finish this step before continuing:</p>
          <ul className="list-disc pl-5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex gap-2">
        {current > 2 ? (
          <Button type="button" variant="outline" onClick={() => go(current - 1)}>
            Back
          </Button>
        ) : null}
        {current < WIZARD_STEPS.length ? (
          <Button type="button" disabled={checking} onClick={() => void next()}>
            Next
          </Button>
        ) : null}
      </div>
    </div>
  );
};
