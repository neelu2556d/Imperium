"use client";

import OnboardingScreen from "@/components/onboarding/OnboardingScreen";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";

/**
 * Placeholder step proving the onboarding framework end-to-end. Real
 * onboarding content (questionnaire, splash, etc.) replaces this later.
 */
export default function WelcomeStep() {
  const onboarding = useOnboarding();

  return (
    <OnboardingScreen
      step="welcome"
      title="Welcome"
      primaryActionLabel="Continue"
      primaryActionDisabled={onboarding.status !== "ready"}
      onPrimaryAction={() => {
        if (onboarding.status === "ready") {
          void onboarding.completeStep("welcome");
        }
      }}
    >
      <p className="text-muted">Onboarding framework placeholder screen.</p>
    </OnboardingScreen>
  );
}
