"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOnboardingState } from "@/lib/supabase/onboarding";
import { getFirstName } from "@/lib/supabase/profile";
import ImperiumGem from "@/components/welcome/ImperiumGem";

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; firstName: string | null };

export default function WelcomeScreen() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getOnboardingState(), getFirstName()])
      .then(([onboarding, firstName]) => {
        if (cancelled) return;
        if (onboarding.isComplete) {
          router.replace("/home");
          return;
        }
        setLoadState({ status: "ready", firstName });
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
  }, [router]);

  if (loadState.status === "error") {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[390px] flex-col items-center justify-center px-6 text-center">
        <p className="text-muted">{loadState.error}</p>
      </div>
    );
  }

  if (loadState.status !== "ready") return null;

  const handleTakeMeIn = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push("/onboarding/setup");
  };

  const greeting = loadState.firstName ? `Hi, ${loadState.firstName}.` : "Hi, there.";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[390px] flex-col items-center justify-center px-6 text-center">
      <ImperiumGem className="vt-rise-in" style={{ animationDelay: "0ms" }} />

      <h1
        className="vt-rise-in mt-10 text-3xl"
        style={{ animationDelay: "200ms" }}
      >
        <span className="block">{greeting}</span>
        <span className="block">I&rsquo;m your Imperium.</span>
      </h1>

      <p
        className="vt-rise-in text-muted mt-4 text-sm"
        style={{ animationDelay: "350ms" }}
      >
        Two quick things and I&rsquo;ve got your back. Let&rsquo;s get you set
        up.
      </p>

      <button
        type="button"
        className="btn-primary vt-rise-in mt-10"
        onClick={handleTakeMeIn}
        disabled={isNavigating}
        style={{ animationDelay: "500ms" }}
      >
        take me in →
      </button>
    </div>
  );
}
