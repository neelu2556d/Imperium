import type { ReactNode } from "react";
import BusinessTopBar from "@/components/business/BusinessTopBar";
import BusinessPillNav from "@/components/business/BusinessPillNav";

/**
 * Shared shell for every `/business/*` sub-page: the top bar and the sticky
 * pill navigation, above the page content. Route access is enforced server-side
 * in `proxy.ts` (owner-only) — this layout is purely presentational.
 */
export default function BusinessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      <BusinessTopBar />
      <BusinessPillNav />
      {children}
    </div>
  );
}
