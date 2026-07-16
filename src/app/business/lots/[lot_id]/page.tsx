import LotDetailScreen from "@/components/business/lots/LotDetailScreen";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ lot_id: string }>;
}) {
  const { lot_id } = await params;

  return <LotDetailScreen lotId={lot_id} />;
}
