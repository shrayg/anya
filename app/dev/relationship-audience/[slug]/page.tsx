import { notFound } from "next/navigation";

import { RelationshipFrame } from "../relationship-frame";

import { getGenderedRelationshipCampaign } from "@/config/gendered-relationship-campaigns";

type RelationshipAudienceRouteProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ format?: string }>;
};

export default async function RelationshipAudienceRoute({
  params,
  searchParams,
}: RelationshipAudienceRouteProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = getGenderedRelationshipCampaign(slug);

  if (!campaign) notFound();

  return (
    <RelationshipFrame
      campaign={campaign}
      format={query.format === "square" ? "square" : "4x5"}
    />
  );
}
