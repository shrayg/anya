import { CampaignFrame } from "./campaign-frame";

import { AD_CAMPAIGNS, getAdCampaign } from "@/config/ad-campaigns";

type CampaignPreviewPageProps = {
  searchParams: Promise<{ campaign?: string; format?: string }>;
};

export default async function CampaignPreviewPage({
  searchParams,
}: CampaignPreviewPageProps) {
  const query = await searchParams;
  const campaign = getAdCampaign(query.campaign) ?? AD_CAMPAIGNS[0];
  const format = query.format === "square" ? "square" : "4x5";

  return <CampaignFrame campaign={campaign} format={format} />;
}
