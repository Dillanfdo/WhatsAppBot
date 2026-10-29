import { Suspense } from "react";
import { OnboardingSection } from "@/components/admin/onboarding/OnboardingSection";

const OnboardingStorePage = ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) => (
  <Suspense fallback={<p className="text-sm text-muted-foreground">Loading setup…</p>}>
    <OnboardingSection params={params} searchParams={searchParams} />
  </Suspense>
);

export default OnboardingStorePage;
