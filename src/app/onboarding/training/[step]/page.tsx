import { notFound } from "next/navigation";
import TrainingWizard from "@/components/onboarding/training/TrainingWizard";
import { TOTAL_STEPS } from "@/lib/onboarding/training/answers";

export default async function TrainingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const parsed = Number(step);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOTAL_STEPS) {
    notFound();
  }

  return <TrainingWizard initialStep={parsed} />;
}
