import RoutineBuilder from "@/components/train/strong/RoutineBuilder";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ routine_id: string }>;
}) {
  const { routine_id } = await params;
  return <RoutineBuilder routineId={routine_id} />;
}
