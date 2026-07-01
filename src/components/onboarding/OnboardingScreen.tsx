import type { ReactNode } from "react";
import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/onboarding/steps";

interface OnboardingScreenProps {
  step: OnboardingStepId;
  title: string;
  children?: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionDisabled?: boolean;
}

export default function OnboardingScreen({
  step,
  title,
  children,
  primaryActionLabel = "Continue",
  onPrimaryAction,
  primaryActionDisabled,
}: OnboardingScreenProps) {
  const stepIndex = ONBOARDING_STEPS.indexOf(step);
  const totalSteps = ONBOARDING_STEPS.length;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-between px-6 py-12">
      <div
        className="mb-8 flex items-center gap-1.5"
        role="progressbar"
        aria-valuenow={stepIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
      >
        {ONBOARDING_STEPS.map((id, index) => (
          <span
            key={id}
            data-no-vitality
            className="h-1 flex-1 rounded-full transition-colors"
            style={{
              background:
                index <= stepIndex
                  ? "var(--color-mint)"
                  : "var(--color-border)",
            }}
          />
        ))}
      </div>

      <div className="card flex-1 p-6">
        <h1 className="mb-4 text-2xl">{title}</h1>
        {children}
      </div>

      {onPrimaryAction && (
        <button
          type="submit"
          className="mt-8 w-full"
          onClick={onPrimaryAction}
          disabled={primaryActionDisabled}
        >
          {primaryActionLabel}
        </button>
      )}
    </div>
  );
}
