import { notFound } from "next/navigation";
import TrainingWizard from "@/components/onboarding/training/TrainingWizard";
import { TOTAL_STEPS } from "@/lib/onboarding/training/answers";

export default async function TrainingStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ redo?: string }>;
}) {
  const { step } = await params;
  const { redo } = await searchParams;
  const parsed = Number(step);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOTAL_STEPS) {
    notFound();
  }

  return <TrainingWizard initialStep={parsed} redo={redo === "1"} />;
}
