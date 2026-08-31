import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "prettier";

import {
  GENDERED_RELATIONSHIP_CAMPAIGNS,
  type RelationshipCampaign,
} from "../config/gendered-relationship-campaigns";

const root = process.cwd();
const outputDirectory = path.join(
  root,
  "output",
  "ads",
  "campaigns",
  "cheating",
);
const docsDirectory = path.join(root, "docs", "ads");

function quoteCsv(value: string | number | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function assetPath(campaign: RelationshipCampaign, format: "4x5" | "square") {
  return `output/ads/campaigns/cheating/${campaign.audience}/${campaign.slug}-${format}.png`;
}

const manifest = GENDERED_RELATIONSHIP_CAMPAIGNS.map((campaign) => ({
  ...campaign,
  assets: {
    primary4x5: assetPath(campaign, "4x5"),
    square: campaign.extraFormat ? assetPath(campaign, "square") : null,
  },
}));

const csvHeader = [
  "campaign_id",
  "audience",
  "audience_description",
  "age_band",
  "platform_lane",
  "hook",
  "headline",
  "caption",
  "cta",
  "fictional_profile",
  "asset_4x5",
  "asset_square",
];

const csvRows = manifest.map((campaign) =>
  [
    campaign.id,
    campaign.audience,
    campaign.audienceLabel,
    campaign.ageBand,
    campaign.platformLane,
    campaign.hook,
    campaign.headline,
    campaign.caption,
    campaign.cta,
    `${campaign.profileName}, ${campaign.profileAge}`,
    campaign.assets.primary4x5,
    campaign.assets.square ?? "",
  ]
    .map(quoteCsv)
    .join(","),
);

function tableFor(audience: "women" | "men") {
  const campaigns = manifest.filter(
    (campaign) => campaign.audience === audience,
  );

  return campaigns
    .map(
      (campaign) =>
        `| ${campaign.id} | ${campaign.hook} | ${campaign.eyebrow} | ${campaign.cta} | ${campaign.extraFormat ? "4:5 + 1:1" : "4:5"} |`,
    )
    .join("\n");
}

const markdown = `# Gender-specific relationship hooks

Generated from \`config/gendered-relationship-campaigns.ts\`.

These are direct-response creative hypotheses for separated audience tests. Every on-frame identity, phone number, handle, profile, and portrait is fictional. The creative asks a question and demonstrates public-identity connections; it does not claim that infidelity has been proven.

## Delivery

- 10 primary 1080x1350 (4:5) ads
- 2 primary-hook 1080x1080 square alternates
- 5 hooks for women evaluating a male partner's unexplained contact
- 5 hooks for men evaluating a female partner's unexplained contact
- Real Anya logo and native React/CSS product interface
- Fictional adult model portraits rendered into the native interface

## Women audience

| ID | On-frame hook | Supporting line | CTA | Formats |
|---|---|---|---|---|
${tableFor("women")}

## Men audience

| ID | On-frame hook | Supporting line | CTA | Formats |
|---|---|---|---|---|
${tableFor("men")}

## Launch discipline

1. Keep these creatives in their own relationship-uncertainty test cells.
2. Use audience gender only to select the relevant pronoun version; do not use the fictional model's race as a targeting or risk signal.
3. Start with the question-based hooks. Avoid ad copy that states or implies Anya has proven cheating.
4. Judge the concepts on landing-page views, search starts, paid conversion, negative feedback, and rejection rate—not CTR alone.
5. Retain \`FICTIONAL DEMO\` on all exported frames.
`;

const formattedMarkdown = await format(markdown, { parser: "markdown" });

await Promise.all([
  mkdir(outputDirectory, { recursive: true }),
  mkdir(docsDirectory, { recursive: true }),
]);

await Promise.all([
  writeFile(
    path.join(outputDirectory, "campaign-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    path.join(outputDirectory, "campaign-copy.csv"),
    `${csvHeader.map(quoteCsv).join(",")}\n${csvRows.join("\n")}\n`,
    "utf8",
  ),
  writeFile(
    path.join(docsDirectory, "GENDERED_RELATIONSHIP_HOOKS.md"),
    formattedMarkdown,
    "utf8",
  ),
]);

console.log(`Exported ${manifest.length} relationship campaigns.`);
