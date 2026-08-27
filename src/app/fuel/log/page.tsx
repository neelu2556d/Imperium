import { Suspense } from "react";
import FoodLoggerScreen from "@/components/fuel/logger/FoodLoggerScreen";

export default function FoodLogPage() {
  return (
    <Suspense fallback={null}>
      <FoodLoggerScreen />
    </Suspense>
  );
}
