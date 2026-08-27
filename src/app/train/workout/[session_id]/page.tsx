import WorkoutScreen from "@/components/train/strong/WorkoutScreen";

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ session_id: string }>;
}) {
  const { session_id } = await params;
  return <WorkoutScreen sessionId={session_id} />;
}
