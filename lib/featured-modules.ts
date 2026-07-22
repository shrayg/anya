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
  /** In-module tools / submodules (Seekria sources, crypto suite, etc.). */
  toolCount?: number;
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
  "Crypto Intel": "CRY",
  Platforms: "PLT",
  "Dating Apps": "DAT",
};

const LANE_DESCRIPTION: Record<string, string> = {
  "AI Intelligence":
    "AI modules query multiple indexes in parallel, then synthesize results into investigator-ready briefs — not raw JSON dumps.",
  "Stealer Intel":
    "Stealer-era credential exposure indexes and IntelX storage pulls for authorized investigations.",
  "Breach & Leaks": "Credential and email exposure across public leak indexes.",
  Identity: "Phone, username, and handle pivots across platforms.",
  "Public Records":
    "US federal, state, sanctions, wanted, court, sex-offender, and international government registry sources.",
  Network: "IP enrichment and network-context lookups.",
  "Financial & Assets":
    "BINs, IBANs, bank metadata, vehicle VIN decoding, and US insurance directories.",
  "Crypto Intel":
    "Wallet lookup, AI analyse, address labels, risk checks, and fund-flow hops. Authorized OSINT / compliance research on public chain data.",
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
    toolCount: def.tools?.length ?? 0,
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

/** Live hub shells (sidebar modules), excluding coming-soon stubs. */
export const CATALOG_LIVE_MODULES: SearchModuleDef[] = getHubSections()
  .flatMap((section) => section.items)
  .filter((module) => !module.comingSoon);

/**
 * Marketed capability count: each live module shell plus every in-module
 * tool / submodule (e.g. Crypto Intel tools, Seekria sources).
 */
export function countModulesIncludingSubmodules(
  modules: SearchModuleDef[],
): number {
  return modules.reduce((total, module) => {
    if (module.comingSoon) return total;

    return total + 1 + (module.tools?.length ?? 0);
  }, 0);
}

export const CATALOG_MODULE_COUNT = countModulesIncludingSubmodules(
  CATALOG_LIVE_MODULES,
);

/** Parent shells only (no submodule inflation). */
export const CATALOG_SHELL_COUNT = CATALOG_LIVE_MODULES.length;

export const AI_CATALOG_MODULES =
  CATALOG_LANES.find((lane) => lane.isAi)?.modules ?? [];

export const STANDARD_CATALOG_LANES = CATALOG_LANES.filter(
  (lane) => !lane.isAi,
);

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

export { AI_SEARCH_MODULES, ALL_SEARCH_MODULES };
