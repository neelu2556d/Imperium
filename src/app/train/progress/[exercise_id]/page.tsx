import ProgressScreen from "@/components/train/progress/ProgressScreen";

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ exercise_id: string }>;
}) {
  const { exercise_id } = await params;

  return <ProgressScreen exerciseId={exercise_id} />;
}
