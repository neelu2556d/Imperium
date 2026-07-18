"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import { getStepIndex, type OnboardingStepId } from "@/lib/onboarding/steps";

/**
 * Renders `children` when `step` is the user's current onboarding step or one
 * they've already completed (so back-navigation and "tap to adjust" revisits
 * work). Jumping *ahead* redirects to the saved step, and a finished user is
 * sent to `/train` — that's what makes "resume from exact screen" and "never
 * see onboarding again" work regardless of which URL is visited directly.
 */
export function OnboardingStepGuard({
  step,
  children,
}: {
  step: OnboardingStepId;
  children: ReactNode;
}) {
  const onboarding = useOnboarding();
  const router = useRouter();

  const allowed =
    onboarding.status === "ready" &&
    !onboarding.isComplete &&
    (onboarding.currentStep === step ||
      getStepIndex(step) < getStepIndex(onboarding.currentStep) ||
      onboarding.completedSteps.includes(step));

  useEffect(() => {
    if (onboarding.status !== "ready") return;

    if (onboarding.isComplete) {
      router.replace("/train");
    } else if (!allowed) {
      router.replace(`/onboarding/${onboarding.currentStep}`);
    }
  }, [onboarding, router, allowed]);

  if (!allowed) return null;

  return <>{children}</>;
}
