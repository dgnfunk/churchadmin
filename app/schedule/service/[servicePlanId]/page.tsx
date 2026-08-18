import { redirect } from "next/navigation";

export default async function LegacyServiceTeamPage({ params }: { params: Promise<{ servicePlanId: string }> }) {
  const { servicePlanId } = await params;
  redirect(`/services/${servicePlanId}?tab=equipo`);
}
