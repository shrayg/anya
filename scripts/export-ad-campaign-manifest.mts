import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AD_CAMPAIGNS,
  AD_CATEGORY_META,
  type AdCampaign,
  type AdCategory,
} from "../config/ad-campaigns";

const root = process.cwd();
const outputDirectory = path.join(root, "output", "ads");
const docsDirectory = path.join(root, "docs", "ads");

function escapeMarkdown(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function quoteCsv(value: string | number | undefined) {
  const normalized = String(value ?? "").replaceAll('"', '""');
  return `"${normalized}"`;
}

function assetPath(campaign: AdCampaign, format: "4x5" | "square") {
  return `output/ads/campaigns/${campaign.category}/${campaign.slug}-${format}.png`;
}

const manifest = AD_CAMPAIGNS.map((campaign) => ({
  ...campaign,
  assets: {
    primary4x5: assetPath(campaign, "4x5"),
    square: campaign.extraFormat ? assetPath(campaign, "square") : null,
  },
}));

const csvHeader = [
  "campaign_id",
  "category",
  "campaign",
  "audience",
  "age_band",
  "platform_lane",
  "hook",
  "headline",
  "caption",
  "cta",
  "landing",
  "asset_4x5",
  "asset_square",
];

const csvRows = manifest.map((campaign) =>
  [
    campaign.id,
    campaign.categoryLabel,
    campaign.campaignName,
    campaign.audience,
    campaign.ageBand,
    campaign.platformLane,
    campaign.hook,
    campaign.headline,
    campaign.caption,
    campaign.cta,
    campaign.landing,
    campaign.assets.primary4x5,
    campaign.assets.square ?? "",
  ]
    .map(quoteCsv)
    .join(","),
);

const categories = Object.keys(AD_CATEGORY_META) as AdCategory[];
const markdownSections = categories.map((category) => {
  const meta = AD_CATEGORY_META[category];
  const campaigns = manifest.filter(
    (campaign) => campaign.category === category,
  );
  const rows = campaigns.map(
    (campaign) =>
      `| ${campaign.id} | ${escapeMarkdown(campaign.campaignName)} | ${escapeMarkdown(campaign.audience)} (${campaign.ageBand}) | ${escapeMarkdown(campaign.hook)} | ${campaign.platformLane} | ${escapeMarkdown(campaign.moduleLabel)} | ${escapeMarkdown(campaign.landing)} | ${escapeMarkdown(campaign.cta)} |`,
  );

  return `## ${meta.label}\n\nAudience language: ${meta.audienceTruth}\n\n| ID | Campaign | Audience | On-frame hook | Lane | Product proof | Landing | CTA |\n|---|---|---|---|---|---|---|---|\n${rows.join("\n")}`;
});

const markdown = `# Anya campaign matrix\n\nGenerated from \`config/ad-campaigns.ts\`. The twenty concepts below are high-conviction starting hypotheses, not guaranteed winners. Keep the offer and landing stable while testing creative variables.\n\n## Delivery\n\n- 20 primary 1080×1350 (4:5) PNGs\n- 4 category-winner 1080×1080 square PNGs\n- Fictional demo data in every product surface\n- Real Anya logo and native Anya product language\n- Exact caption, headline, CTA, audience, lane, and landing metadata in \`output/ads/campaign-copy.csv\`\n\n## Lane definitions\n\n- **Paid-safe:** the default paid-social version; still requires final account-level policy review.\n- **Paid-edgy:** direct emotional copy intended for less restrictive placements or a softened paid variant.\n- **Organic-first:** run in organic/creator environments first; do not upload unchanged to broad paid targeting.\n\n${markdownSections.join("\n\n")}\n\n## Launch discipline\n\n1. Start with exposure/self-search and trust-before-contact for the cleanest utility story.\n2. Run relationship uncertainty and parent-safety copy in separated ad sets and watch rejection, negative feedback, and landing quality closely.\n3. Judge creative with outbound CTR, landing-page views, search starts, registration, and paid conversion—not clicks alone.\n4. Treat each hook as a hypothesis. Promote winners only after enough spend and conversion events to reduce noise.\n5. Keep public-identity language on babysitter, coach, contractor, and home-entry campaigns. Anya is not positioned here for employment, housing, credit, or insurance decisions.\n`;

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
  writeFile(path.join(docsDirectory, "CAMPAIGN_MATRIX.md"), markdown, "utf8"),
]);

console.log(`Exported ${manifest.length} campaigns to ${outputDirectory}`);
