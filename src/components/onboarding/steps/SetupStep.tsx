"use client";

import OnboardingScreen from "@/components/onboarding/OnboardingScreen";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";

/**
 * Placeholder step proving the onboarding framework end-to-end. Real
 * onboarding content (questionnaire, etc.) replaces this later.
 */
export default function SetupStep() {
  const onboarding = useOnboarding();

  return (
    <OnboardingScreen
      step="setup"
      title="Setup"
      primaryActionLabel="Continue"
      primaryActionDisabled={onboarding.status !== "ready"}
      onPrimaryAction={() => {
        if (onboarding.status === "ready") {
          void onboarding.completeStep("setup");
        }
      }}
    >
      <p className="text-muted">Onboarding framework placeholder screen.</p>
    </OnboardingScreen>
  );
}
