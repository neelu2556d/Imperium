import WelcomeScreen from "@/components/welcome/WelcomeScreen";

// Depends on a live Supabase session; never prerender it statically.
export const dynamic = "force-dynamic";

export default function WelcomePage() {
  return <WelcomeScreen />;
}
