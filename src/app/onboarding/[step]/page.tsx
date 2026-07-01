import { notFound } from "next/navigation";
import { isOnboardingStepId, STEP_COMPONENTS } from "@/lib/onboarding/steps";
import { OnboardingStepGuard } from "@/lib/onboarding/OnboardingStepGuard";

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;

  if (!isOnboardingStepId(step)) {
    notFound();
  }

  const StepComponent = STEP_COMPONENTS[step];

  return (
    <OnboardingStepGuard step={step}>
      <StepComponent />
    </OnboardingStepGuard>
  );
}
