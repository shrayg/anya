import {
  AI_SEARCH_MODULES,
  ALL_SEARCH_MODULES,
  getHubSections,
  type SearchModuleDef,
} from "@/lib/search-modules";

export type CatalogModule = {
  code: string;
  name: string;
  slug: string;
  hint: string;
  summary?: string;
};

export type CatalogLane = {
  label: string;
  description?: string;
  isAi?: boolean;
  modules: CatalogModule[];
};

const LANE_PREFIX: Record<string, string> = {
  "AI Intelligence": "AI",
  "Stealer Intel": "STL",
  "Breach & Leaks": "BRK",
  Identity: "ID",
  "Public Records": "USR",
  Network: "NET",
  "Financial & Assets": "FIN",
  Platforms: "PLT",
  "Dating Apps": "DAT",
};

const LANE_DESCRIPTION: Record<string, string> = {
  "AI Intelligence":
    "AI modules query multiple indexes in parallel, then synthesize results into investigator-ready briefs — not raw JSON dumps.",
  "Stealer Intel":
    "Infostealer-era credential exposure indexes and storage pulls for authorized investigations.",
  "Breach & Leaks": "Credential and email exposure across public leak indexes.",
  Identity: "Phone, username, and handle pivots across platforms.",
  "Public Records":
    "US court dockets and composed public-registry identity signals from government indexes.",
  Network: "IP enrichment and network-context lookups.",
  "Financial & Assets":
    "Wallets, BINs, IBANs, bank metadata, vehicle VIN decoding, and US insurance directories.",
  Platforms:
    "Live profile and breach-index lookups for gaming and social platforms.",
  "Dating Apps":
    "Dating profile and handle searches across Tinder, Bumble, Hinge, Match, and more.",
};

function toCatalogModule(
  def: SearchModuleDef,
  index: number,
  prefix: string,
): CatalogModule {
  return {
    code: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    name: def.name,
    slug: def.slug,
    hint: def.hint,
    summary: def.section === "AI Intelligence" ? def.tagline : undefined,
  };
}

export const CATALOG_LANES: CatalogLane[] = getHubSections().map((section) => ({
  label: section.title,
  description: LANE_DESCRIPTION[section.title],
  isAi: section.title === "AI Intelligence",
  modules: section.items.map((item, index) =>
    toCatalogModule(item, index, LANE_PREFIX[section.title] ?? "MOD"),
  ),
}));

export const CATALOG_MODULE_COUNT = ALL_SEARCH_MODULES.length;

export const AI_CATALOG_MODULES = CATALOG_LANES.find((lane) => lane.isAi)
  ?.modules ?? [];

export const STANDARD_CATALOG_LANES = CATALOG_LANES.filter((lane) => !lane.isAi);

/** Short blurbs for the AI showcase cards on the marketing page. */
export const AI_MODULE_EXPLAINERS: Record<string, string> = {
  "ai-search":
    "Enter any target — email, username, IP, or handle. The model stitches breach hits, network signals, and social footprints into one readable brief with source citations.",
  "ai-deep-scan":
    "Maximum-depth mode. Every relevant index is queried in parallel for your input type, then merged into a single deep-scan report with overlap highlights.",
  "crypto-ai":
    "Paste a Bitcoin or Ethereum wallet. Get on-chain heuristics, risk scoring, known exchange tags, and any breach correlation tied to that address.",
  "threat-brief":
    "Focused exposure pass for email, username, IP, or domain. Returns risk signals, leaked-credential context, and suggested next pivots for your case.",
};

export { AI_SEARCH_MODULES };
