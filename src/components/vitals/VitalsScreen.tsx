"use client";

import SleepSection from "@/components/vitals/SleepSection";
import WaterSection from "@/components/vitals/WaterSection";
import BodyWeightSection from "@/components/vitals/BodyWeightSection";
import PhotosSection from "@/components/vitals/PhotosSection";

/**
 * The /vitals tab: a single scrollable column of four self-contained sections —
 * sleep, water, body weight, and progress photos. Each owns its own data
 * fetching and mutations; this shell just lays them out and titles the page.
 */
export default function VitalsScreen() {
  return (
    <div className="mx-auto w-full max-w-md px-5 pb-28 pt-8 md:max-w-lg md:px-8">
      <header className="mb-6">
        <p className="mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
          Daily check-in
        </p>
        <h1 className="serif-italic mt-1 text-4xl leading-tight" data-no-vitality>
          Vitals
        </h1>
      </header>

      <div className="flex flex-col gap-4">
        <SleepSection />
        <WaterSection />
        <BodyWeightSection />
        <PhotosSection />
      </div>
    </div>
  );
}
