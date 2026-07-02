"use client";

import OnboardingScreen from "@/components/onboarding/OnboardingScreen";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";

/**
 * Placeholder for the split-reveal screen the training quiz hands off to.
 * The real /onboarding/split experience is built separately; this keeps the
 * flow navigable end-to-end in the meantime.
 */
export default function SplitStep() {
  const onboarding = useOnboarding();

  return (
    <OnboardingScreen
      step="split"
      title="Your split"
      primaryActionLabel="Finish"
      primaryActionDisabled={onboarding.status !== "ready"}
      onPrimaryAction={() => {
        if (onboarding.status === "ready") {
          void onboarding.completeStep("split");
        }
      }}
    >
      <p className="text-muted">
        We&rsquo;ll build your training split from everything you just told us.
      </p>
    </OnboardingScreen>
  );
}
