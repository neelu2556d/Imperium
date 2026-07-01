import { OnboardingProvider } from "@/lib/onboarding/OnboardingProvider";

// Onboarding depends on a live Supabase session; never prerender it statically.
export const dynamic = "force-dynamic";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingProvider>{children}</OnboardingProvider>;
}
