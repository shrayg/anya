import { RelationshipFrame } from "./relationship-frame";

import { GENDERED_RELATIONSHIP_CAMPAIGNS } from "@/config/gendered-relationship-campaigns";

type RelationshipAudiencePageProps = {
  searchParams: Promise<{ campaign?: string; format?: string }>;
};

export default async function RelationshipAudiencePage({
  searchParams,
}: RelationshipAudiencePageProps) {
  const query = await searchParams;
  const campaign =
    GENDERED_RELATIONSHIP_CAMPAIGNS.find(
      (candidate) => candidate.slug === query.campaign,
    ) ?? GENDERED_RELATIONSHIP_CAMPAIGNS[0];

  return (
    <RelationshipFrame
      campaign={campaign}
      format={query.format === "square" ? "square" : "4x5"}
    />
  );
}
