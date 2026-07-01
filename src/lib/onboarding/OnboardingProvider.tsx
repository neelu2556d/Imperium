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
        : await advanceOnboardingStep(step, current.completedSteps);

      if (onboarding.isComplete) {
        setOnboardingCompleteCookie();
      }

      setLoadState({ status: "ready", ...onboarding });

      router.replace(
        onboarding.isComplete ? "/train" : `/onboarding/${onboarding.currentStep}`
      );
    },
    [router]
  );

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
      value={{ ...loadState, completeStep, resetOnboarding }}
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
