"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  advanceOnboardingStep,
  completeOnboarding as completeOnboardingRequest,
  getOnboardingState,
  markStepComplete,
  resetOnboarding as resetOnboardingRequest,
} from "@/lib/supabase/onboarding";
import { getNextStep, type OnboardingStepId } from "@/lib/onboarding/steps";
import type { OnboardingState } from "@/lib/onboarding/types";
import {
  clearOnboardingCompleteCookie,
  setOnboardingCompleteCookie,
} from "@/lib/onboarding/cookie";

type OnboardingLoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | ({ status: "ready" } & OnboardingState);

export type OnboardingContextValue = OnboardingLoadState & {
  completeStep: (step: OnboardingStepId) => Promise<void>;
  /**
   * Records a hub sub-screen (e.g. 'macros', 'mentor') in completed_steps
   * without advancing current_step, keeping the in-memory state in sync so
   * the setup hub reflects it immediately on return.
   */
  completeSubStep: (step: string) => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<OnboardingLoadState>({
    status: "loading",
  });
  const loadStateRef = useRef(loadState);

  useEffect(() => {
    loadStateRef.current = loadState;
  }, [loadState]);

  const completeStep = useCallback(
    async (step: OnboardingStepId) => {
      const current = loadStateRef.current;
      if (current.status !== "ready") return;

      const isLastStep = getNextStep(step) === null;
      const onboarding = isLastStep
        ? await completeOnboardingRequest()
        : await advanceOnboardingStep(step);

      if (onboarding.isComplete) {
        setOnboardingCompleteCookie();
      }

      setLoadState({ status: "ready", ...onboarding });

      router.replace(
        onboarding.isComplete ? "/home" : `/onboarding/${onboarding.currentStep}`
      );
    },
    [router]
  );

  const completeSubStep = useCallback(async (step: string) => {
    await markStepComplete(step);
    const current = loadStateRef.current;
    if (current.status !== "ready" || current.completedSteps.includes(step)) {
      return;
    }
    setLoadState({
      ...current,
      completedSteps: [...current.completedSteps, step],
    });
  }, []);

  const resetOnboarding = useCallback(async () => {
    const onboarding = await resetOnboardingRequest();
    clearOnboardingCompleteCookie();
    setLoadState({ status: "ready", ...onboarding });
    router.replace(`/onboarding/${onboarding.currentStep}`);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    getOnboardingState()
      .then((onboarding) => {
        if (cancelled) return;
        if (onboarding.isComplete) {
          setOnboardingCompleteCookie();
        }
        setLoadState({ status: "ready", ...onboarding });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ ...loadState, completeStep, completeSubStep, resetOnboarding }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
