import { redirect } from "next/navigation";

// The wizard re-clamps to the user's true resume step (from saved answers)
// once mounted, so entering at step 1 is safe.
export default function TrainingIndexPage() {
  redirect("/onboarding/training/1");
}
