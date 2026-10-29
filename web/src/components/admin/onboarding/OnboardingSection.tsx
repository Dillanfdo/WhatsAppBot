import { notFound } from "next/navigation";
import { z } from "zod";
import { OnboardingResume } from "@/components/admin/onboarding/OnboardingResume";
import { getStore, listStoreHours } from "@/lib/stores";

type OnboardingSectionProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
};

export const OnboardingSection = async ({ params, searchParams }: OnboardingSectionProps) => {
  const { id } = await params;
  const { step } = await searchParams;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }

  const store = await getStore(id);
  const hours = store ? await listStoreHours(id) : null;
  if (!store || !hours) {
    notFound();
  }

  return <OnboardingResume store={store} hours={hours} step={Number(step ?? "2")} />;
};
