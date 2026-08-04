import { notFound } from "next/navigation";

import { CampaignFrame } from "../campaign-frame";

import { getAdCampaign } from "@/config/ad-campaigns";

type CampaignRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ format?: string }>;
};

export default async function CampaignRoute({
  params,
  searchParams,
}: CampaignRouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = getAdCampaign(slug);

  if (!campaign) notFound();

  return (
    <CampaignFrame
      campaign={campaign}
      format={query.format === "square" ? "square" : "4x5"}
    />
  );
}
