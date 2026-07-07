import type { ReactNode } from "react";
import ImperiumGem from "@/components/welcome/ImperiumGem";

interface AuthCardProps {
  /** Newsreader-italic heading, e.g. "Create your account". */
  heading: string;
  children: ReactNode;
}

/**
 * Shared shell for the auth screens: the app backdrop (aurora + mountains +
 * particles) is already rendered globally by the root layout, so this just
 * centres a raised glass card carrying a smaller gem mark and the heading.
 */
export default function AuthCard({ heading, children }: AuthCardProps) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[420px] flex-col items-center justify-center px-6">
      <div className="card-raised vt-rise-in w-full max-w-[360px] p-7">
        <div className="flex flex-col items-center">
          <ImperiumGem size={64} showChevron={false} />
          <h1 className="serif-italic mt-5 text-center text-2xl">{heading}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
