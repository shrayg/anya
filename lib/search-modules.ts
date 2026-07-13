export type SearchModuleDef = {
  name: string;
  slug: string;
  module: string;
  hint: string;
  section: string;
  tagline: string;
  aiMode?: string;
  comingSoon?: boolean;
};

export type SearchModuleSection = {
  title: string;
  items: SearchModuleDef[];
};

function mod(
  section: string,
  name: string,
  slug: string,
  module: string,
  hint: string,
  tagline: string,
  aiMode?: string,
  comingSoon?: boolean,
): SearchModuleDef {
  return { name, slug, module, hint, section, tagline, aiMode, comingSoon };
}

export const AI_SEARCH_MODULES: SearchModuleDef[] = [
  mod(
    "AI Intelligence",
    "AI Search",
    "ai-search",
    "ai",
    "Any target — cross-source AI synthesis",
    "Cross-source AI synthesis — breach, network, and social signals in one brief.",
    "search",
  ),
  mod(
    "AI Intelligence",
    "AI Deep Scan",
    "ai-deep-scan",
    "ai",
    "Email, IP, domain, username, or Discord ID",
    "Maximum-depth pass — every relevant index queried in parallel.",
    "deep",
  ),
  mod(
    "AI Intelligence",
    "Crypto AI Analyse",
    "crypto-ai",
    "ai",
    "Bitcoin (1/3/bc1) or Ethereum (0x) wallet",
    "On-chain heuristics, risk scoring, and breach correlation for wallets.",
    "crypto",
  ),
  mod(
    "AI Intelligence",
    "Threat Brief",
    "threat-brief",
    "ai",
    "Email, username, IP, or domain",
    "Focused exposure scan with risk signals and next-step recommendations.",
    "threat",
  ),
];

export const SEARCH_MODULE_SECTIONS: SearchModuleSection[] = [
  {
    title: "Stealer Intel",
    items: [
      mod(
        "Stealer Intel",
        "IntelX",
        "intelx",
        "breach",
        "IntelX storage ID",
        "Pull archived intel by IntelX storage identifier.",
      ),
      mod(
        "Stealer Intel",
        "Stealer Logs",
        "stealer-logs",
        "breach",
        "IP, email, or domain",
        "Stealer indexes and COMB breach data — search by IP, email, or domain.",
      ),
    ],
  },
  {
    title: "Breach & Leaks",
    items: [
      mod(
        "Breach & Leaks",
        "Breaches",
        "breaches",
        "breaches",
        "Email address only",
        "Search leaked credentials for a specific email.",
      ),
      mod(
        "Breach & Leaks",
        "Hash Lookup",
        "hash-lookup",
        "breach",
        "MD5, SHA-1, SHA-256, or other hash",
        "Pivot breach indexes by password or file hash.",
      ),
      mod(
        "Breach & Leaks",
        "Password Search",
        "password-search",
        "breach",
        "Plaintext or leaked password",
        "Find accounts and leaks tied to a password string.",
      ),
    ],
  },
  {
    title: "Identity",
    items: [
      mod(
        "Identity",
        "Phone",
        "phone",
        "auto",
        "Detected automatically — enter any phone format",
        "Drop a number — format is detected and the lookup is routed automatically.",
      ),
      mod(
        "Identity",
        "Username",
        "username",
        "breach",
        "Username across platforms",
        "Pivot a handle across indexes and public footprints.",
      ),
      mod(
        "Identity",
        "Name Search",
        "name-search",
        "breach",
        "First and last name",
        "Search breach indexes by real name.",
      ),
    ],
  },
  {
    title: "Network",
    items: [
      mod(
        "Network",
        "IP",
        "ip",
        "ip",
        "IPv4 address",
        "Geolocate, enrich, and cross-reference IP intelligence.",
      ),
      mod(
        "Network",
        "Domain",
        "domain",
        "domains",
        "Domain name (e.g. example.com)",
        "Stealer logs, breach data, and domain intelligence pivots.",
      ),
    ],
  },
  {
    title: "Financial & Assets",
    items: [
      mod(
        "Financial & Assets",
        "Crypto Wallet",
        "crypto-wallet",
        "crypto-wallet",
        "Bitcoin (1/3/bc1), Ethereum (0x), or Solana address",
        "Live balance, token holdings, recent transactions, and on-chain stats.",
      ),
      mod(
        "Financial & Assets",
        "BIN Lookup",
        "bin-lookup",
        "bin",
        "First 6–8 digits of a card number",
        "Identify issuing bank, card type, brand, and country from a BIN.",
      ),
      mod(
        "Financial & Assets",
        "IBAN Check",
        "iban-check",
        "iban",
        "IBAN account number",
        "Validate an IBAN and resolve linked bank and BIC metadata.",
      ),
      mod(
        "Financial & Assets",
        "Bank Search US",
        "bank-search",
        "bank",
        "Bank name, US state code, or FDIC cert #",
        "Search US FDIC-insured institutions — metadata only, not account balances.",
      ),
      mod(
        "Financial & Assets",
        "VIN Decoder US",
        "vin-decoder",
        "vin",
        "17-character vehicle VIN",
        "Decode make, model, year, and specs via NHTSA.",
      ),
      mod(
        "Financial & Assets",
        "Car Insurance US",
        "car-insurance-us",
        "car-insurance",
        "Insurer name, keyword, or US state code",
        "Search major US auto insurers — State Farm, GEICO, Progressive, and more.",
      ),
      mod(
        "Financial & Assets",
        "Health Care US",
        "healthcare-us",
        "healthcare",
        "Plan name, keyword, or US state code",
        "Search US health insurers and systems — UnitedHealthcare, Aetna, Kaiser, and more.",
      ),
    ],
  },
  {
    title: "Platforms",
    items: [
      mod(
        "Platforms",
        "Discord ID",
        "discord-id",
        "discord",
        "Discord snowflake ID",
        "Live profile plus indexed leak records for a Discord account.",
      ),
      mod(
        "Platforms",
        "Roblox",
        "roblox",
        "roblox",
        "Roblox username",
        "Lookup Roblox profiles and cross-platform links.",
      ),
      mod(
        "Platforms",
        "Minecraft",
        "minecraft",
        "breach",
        "Minecraft username or UUID",
        "Search Minecraft breach and OSINT indexes.",
      ),
      mod(
        "Platforms",
        "Steam",
        "steam",
        "breach",
        "Steam ID or profile link",
        "Find Steam IDs, aliases, and linked accounts.",
      ),
      mod(
        "Platforms",
        "Xbox",
        "xbox",
        "breach",
        "Gamertag or Xbox ID",
        "Xbox gamertag and profile intelligence.",
        undefined,
        true,
      ),
      mod(
        "Platforms",
        "PlayStation",
        "playstation",
        "breach",
        "PSN username or ID",
        "PlayStation Network username lookups.",
        undefined,
        true,
      ),
      mod(
        "Platforms",
        "Telegram",
        "telegram",
        "breach",
        "Telegram @username",
        "Telegram handle and channel footprint search.",
      ),
      mod(
        "Platforms",
        "Instagram",
        "instagram",
        "breach",
        "Instagram user or profile link",
        "Instagram username and profile URL search.",
      ),
      mod(
        "Platforms",
        "Snapchat",
        "snapchat",
        "breach",
        "Snapchat user or profile link",
        "Snapchat username and link pivots.",
      ),
      mod(
        "Platforms",
        "TikTok",
        "tiktok",
        "breach",
        "TikTok user or profile link",
        "TikTok handle and profile URL intel.",
      ),
      mod(
        "Platforms",
        "Twitter",
        "twitter",
        "breach",
        "X / Twitter user or profile link",
        "X and legacy Twitter username search.",
      ),
      mod(
        "Platforms",
        "Reddit",
        "reddit",
        "reddit",
        "Reddit user or profile link",
        "Reddit account history and metadata.",
      ),
      mod(
        "Platforms",
        "GitHub",
        "github",
        "breach",
        "GitHub user or profile link",
        "GitHub usernames, repos, and leaked emails.",
      ),
      mod(
        "Platforms",
        "FiveM",
        "fivem",
        "fivem",
        "Linked Discord ID",
        "FiveM server intel via linked Discord snowflake.",
      ),
    ],
  },
  {
    title: "Dating Apps",
    items: [
      mod(
        "Dating Apps",
        "Tinder",
        "tinder",
        "breach",
        "Tinder username or profile link",
        "Search Tinder handles and profile URLs across breach and OSINT indexes.",
      ),
      mod(
        "Dating Apps",
        "Bumble",
        "bumble",
        "breach",
        "Bumble username or profile link",
        "Bumble handle and profile URL intelligence.",
      ),
      mod(
        "Dating Apps",
        "Hinge",
        "hinge",
        "breach",
        "Hinge username or profile link",
        "Hinge profile and handle footprint search.",
      ),
      mod(
        "Dating Apps",
        "Match",
        "match",
        "breach",
        "Match.com username or profile link",
        "Match.com handle and profile URL pivots.",
      ),
      mod(
        "Dating Apps",
        "OkCupid",
        "okcupid",
        "breach",
        "OkCupid username or profile link",
        "OkCupid handle and profile URL search.",
      ),
      mod(
        "Dating Apps",
        "Plenty of Fish",
        "pof",
        "breach",
        "POF username or profile link",
        "Plenty of Fish handle and profile URL intel.",
      ),
      mod(
        "Dating Apps",
        "Grindr",
        "grindr",
        "breach",
        "Grindr username or profile link",
        "Grindr handle and profile URL search.",
      ),
      mod(
        "Dating Apps",
        "Badoo",
        "badoo",
        "breach",
        "Badoo username or profile link",
        "Badoo handle and profile URL intelligence.",
      ),
    ],
  },
];

export const ALL_SEARCH_MODULES: SearchModuleDef[] = [
  ...AI_SEARCH_MODULES,
  ...SEARCH_MODULE_SECTIONS.flatMap((s) => s.items),
];

const MODULE_BY_NAME = new Map<string, SearchModuleDef>();
const MODULE_BY_SLUG = new Map<string, SearchModuleDef>();

for (const item of ALL_SEARCH_MODULES) {
  MODULE_BY_NAME.set(item.name, item);
  MODULE_BY_SLUG.set(item.slug, item);
}

export function getSearchModule(
  itemName: string | null,
): SearchModuleDef | undefined {
  if (!itemName) return undefined;
  return MODULE_BY_NAME.get(itemName);
}

export function getSearchModuleBySlug(
  slug: string | null,
): SearchModuleDef | undefined {
  if (!slug) return undefined;
  return MODULE_BY_SLUG.get(slug.toLowerCase());
}

export function getSearchModuleHint(itemName: string | null): string | undefined {
  return getSearchModule(itemName)?.hint;
}

export function resolveApiModule(
  itemName: string | null,
  fallback: string,
): string {
  return getSearchModule(itemName)?.module ?? fallback;
}

export function isPhoneQuery(query: string): boolean {
  const trimmed = query.trim();

  if (!/^[\d\s+\-().]+$/.test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, "");

  return digits.length >= 10 && digits.length <= 15;
}

export function detectSearchType(query: string): string {
  const trimmed = query.trim();

  if (isPhoneQuery(trimmed)) return "breach";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "breach";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return "ip";
  if (/^\d{17,20}$/.test(trimmed)) return "discord";
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return "dns";

  return "breach";
}

export function getAiModeForModule(moduleDef: SearchModuleDef): string {
  if (moduleDef.aiMode) return moduleDef.aiMode;
  if (moduleDef.module !== "ai") return "search";
  return "auto";
}

const SLUG_API_ROUTES: Record<string, string> = {
  breaches: "breaches",
  domains: "domains",
  "crypto-wallet": "crypto-wallet",
  "bin-lookup": "bin",
  "iban-check": "iban",
  "bank-search": "bank",
  "vin-decoder": "vin",
  "car-insurance-us": "car-insurance",
  "healthcare-us": "healthcare",
  "discord-id": "discord",
  roblox: "roblox",
  reddit: "reddit",
  minecraft: "minecraft",
  fivem: "fivem",
  domain: "domains",
  "hash-lookup": "breach",
  "password-search": "breach",
  "name-search": "breach",
  ip: "ip",
  intelx: "intelx",
  "stealer-logs": "breach",
  phone: "breach",
  username: "breach",
  steam: "breach",
  telegram: "breach",
  instagram: "breach",
  snapchat: "breach",
  tiktok: "breach",
  twitter: "breach",
  github: "breach",
  tinder: "breach",
  bumble: "breach",
  hinge: "breach",
  match: "breach",
  okcupid: "breach",
  pof: "breach",
  grindr: "breach",
  badoo: "breach",
};

export function resolveSearchApiType(
  moduleDef: SearchModuleDef,
  query: string,
): string {
  const slugRoute = SLUG_API_ROUTES[moduleDef.slug];

  if (slugRoute) {
    return slugRoute;
  }

  if (moduleDef.module === "auto") {
    return detectSearchType(query);
  }

  return moduleDef.module;
}

export function getHubSections(): SearchModuleSection[] {
  return [
    { title: "AI Intelligence", items: AI_SEARCH_MODULES },
    ...SEARCH_MODULE_SECTIONS,
  ];
}

/** @deprecated Use live health from /api/osint/modules/health via ModuleStatusDot. */
export const MODULE_OPERATIONAL: Record<string, boolean> = {
  "ai-search": true,
  "ai-deep-scan": true,
  "crypto-ai": true,
  "threat-brief": true,
  intelx: true,
  "stealer-logs": true,
  breaches: true,
  phone: true,
  username: true,
  ip: true,
  domain: true,
  "hash-lookup": true,
  "password-search": true,
  "name-search": true,
  "crypto-wallet": true,
  "bin-lookup": true,
  "iban-check": true,
  "bank-search": true,
  "vin-decoder": true,
  "car-insurance-us": true,
  "healthcare-us": true,
  "discord-id": true,
  roblox: true,
  minecraft: true,
  steam: true,
  xbox: false,
  playstation: false,
  telegram: true,
  instagram: true,
  snapchat: true,
  tiktok: true,
  twitter: true,
  reddit: true,
  github: true,
  fivem: true,
  tinder: true,
  bumble: true,
  hinge: true,
  match: true,
  okcupid: true,
  pof: true,
  grindr: true,
  badoo: true,
};

export function isModuleOperational(slug: string): boolean {
  return MODULE_OPERATIONAL[slug] ?? false;
}
