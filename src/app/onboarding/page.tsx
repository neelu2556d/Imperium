import { redirect } from "next/navigation";
import { getFirstStep } from "@/lib/onboarding/steps";

export default function OnboardingIndexPage() {
  redirect(`/onboarding/${getFirstStep()}`);
}
