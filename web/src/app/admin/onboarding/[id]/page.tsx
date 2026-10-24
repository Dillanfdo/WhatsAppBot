import { notFound } from "next/navigation";
import { z } from "zod";
import { OnboardingResume } from "@/components/admin/OnboardingWizard";
import { getStore, listStoreHours } from "@/lib/stores";

const OnboardingStorePage = async ({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) => {
  const { id } = await params;
  const { step } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const store = await getStore(id);
  const hours = store ? await listStoreHours(id) : null;
  if (!store || !hours) notFound();
  return <OnboardingResume store={store} hours={hours} step={Number(step ?? "2")} />;
};

export default OnboardingStorePage;
