import PartyDetailScreen from "@/components/business/parties/PartyDetailScreen";

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ party_id: string }>;
}) {
  const { party_id } = await params;

  return <PartyDetailScreen partyId={party_id} />;
}
