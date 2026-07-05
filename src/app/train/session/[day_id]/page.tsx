import SessionScreen from "@/components/train/session/SessionScreen";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ day_id: string }>;
}) {
  const { day_id } = await params;

  return <SessionScreen dayId={day_id} />;
}
