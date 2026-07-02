"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The 'training' step lives in its own nested route
 * (/onboarding/training/[step]). This registry entry only exists to satisfy
 * the step registry's type; in practice the static /onboarding/training route
 * shadows the [step] route, so this simply forwards there if ever reached.
 */
export default function TrainingStep() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/onboarding/training");
  }, [router]);
  return null;
}
