"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/OnboardingProvider";
import type { OnboardingStepId } from "@/lib/onboarding/steps";

/**
 * Renders `children` only when `step` is the user's current onboarding
 * step. Otherwise redirects to wherever the user actually belongs — their
 * saved step if onboarding is in progress, or `/train` if it's already
 * complete. This is what makes "resume from exact screen" and "never see
 * onboarding again" work regardless of which URL is visited directly.
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

  useEffect(() => {
    if (onboarding.status !== "ready") return;

    if (onboarding.isComplete) {
      router.replace("/train");
    } else if (onboarding.currentStep !== step) {
      router.replace(`/onboarding/${onboarding.currentStep}`);
    }
  }, [onboarding, router, step]);

  if (onboarding.status !== "ready") return null;
  if (onboarding.isComplete || onboarding.currentStep !== step) return null;

  return <>{children}</>;
}
