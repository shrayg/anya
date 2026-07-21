import {
  CRYPTO_INTEL_SECTION_TITLE,
  isCryptoIntelEnabled,
  isCryptoIntelSlug,
} from "@/lib/crypto-intel/enabled";
import {
  isTinderLiveEnabled,
  isTinderLiveSlug,
} from "@/lib/tinder-live/enabled";

const CRYPTO_WALLET_FALLBACK_SECTION = "Financial & Assets";
const CRYPTO_AI_FALLBACK_SECTION = "AI Intelligence";

export type ModuleTool = {
  id: string;
  label: string;
  /** OSINT API segment used when this tool is selected. */
  apiType: string;
};

/** Optional narrowing fields — empty means open-ended search. */
export type ModuleOptionalFilter = {
  id: "state" | "city" | "county" | "zip" | "dob";
  label: string;
  placeholder: string;
};

/**
 * Module catalog entry. Pages render via `ModuleSearchView`, which always
 * shows the shared Intel Signal Lattice loader while a run is in flight —
 * new modules inherit that UI automatically (no per-module loader wiring).
 */
export type SearchModuleDef = {
  name: string;
  slug: string;
  module: string;
  hint: string;
  section: string;
  tagline: string;
  aiMode?: string;
  comingSoon?: boolean;
  /** Optional in-module source tools (e.g. leak indexes vs court dockets). */
  tools?: ModuleTool[];
  /** Optional geographic / identity filters users can fill when they know them. */
  optionalFilters?: ModuleOptionalFilter[];
  /** Show lawful-use / FCRA notice on the module page. */
  lawfulUseNotice?: boolean;
  /** Override default lawful-use notice copy. */
  lawfulUseCopy?: string;
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
  extras?: Pick<
    SearchModuleDef,
    "tools" | "optionalFilters" | "lawfulUseNotice" | "lawfulUseCopy"
  >,
): SearchModuleDef {
  return {
    name,
    slug,
    module,
    hint,
    section,
    tagline,
    aiMode,
    comingSoon,
    ...extras,
  };
}

const PERSON_GEO_FILTERS: ModuleOptionalFilter[] = [
  { id: "state", label: "State", placeholder: "VA (optional)" },
  { id: "city", label: "City", placeholder: "Richmond (optional)" },
  { id: "county", label: "County", placeholder: "Fairfax (optional)" },
  { id: "zip", label: "ZIP", placeholder: "22030 (optional)" },
  { id: "dob", label: "DOB", placeholder: "MM/DD/YYYY (optional)" },
];

/** Compose free-text query + optional filters into parser-friendly input. */
export function composeModuleQuery(
  baseQuery: string,
  filters: Partial<Record<ModuleOptionalFilter["id"], string>>,
): string {
  let name = baseQuery.trim().replace(/\s+/g, " ");

  if (!name && !filters.zip) return "";

  const state = filters.state?.trim().toUpperCase();
  const city = filters.city?.trim();
  const countyRaw = filters.county?.trim();
  const zip = filters.zip?.trim();
  const dob = filters.dob?.trim();

  const county = countyRaw
    ? /county$/i.test(countyRaw)
      ? countyRaw
      : `${countyRaw} County`
    : undefined;

  // ZIP-only open search (NSOPW supports this)
  if (!name && zip) {
    return [zip, state].filter(Boolean).join(", ");
  }

  const locality = county || city;
  const trailing: string[] = [];

  if (locality) trailing.push(locality);
  if (state) trailing.push(state);
  if (zip && !trailing.includes(zip)) {
    // Prefer "Name, ST ZIP" or "Name, ZIP"
    if (state) {
      trailing[trailing.length - 1] = `${state} ${zip}`;
    } else {
      trailing.push(zip);
    }
  }

  let composed = name;

  if (trailing.length) composed = `${name}, ${trailing.join(", ")}`;
  if (dob) composed = `${composed} ${dob}`;

  return composed.replace(/\s+/g, " ").trim();
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
    "Bitcoin (1/3/bc1), Litecoin (L/M/ltc1), or Ethereum (0x) wallet",
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
        "Paste Storage ID or URL",
        "Paste a Storage ID (long hex) or a share link that includes storageid. Share links with only ?did= cannot be opened. Buckets are resolved automatically.",
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
        "Email, username, or search term",
        "Unified breach search — Comb, Breach Index, and every connected leak provider in one module.",
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
      mod(
        "Breach & Leaks",
        "Email Analyzer",
        "email-analyze",
        "email-analyze",
        "Email address",
        "AI breach brief — exposure, platforms, credential risk, and domain intel.",
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
        "Pivot a handle across leak indexes or live public profile URLs.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "leak-indexes",
              label: "Leak indexes",
              apiType: "breach",
            },
            {
              id: "account-finder",
              label: "Account finder",
              apiType: "username-accounts",
            },
          ],
        },
      ),
      mod(
        "Identity",
        "Account Finder",
        "account-finder",
        "username-accounts",
        "Username — scan 200+ public profile URLs",
        "Username → accounts: check coding, social, gaming, music, and more for live public profiles.",
      ),
      mod(
        "Identity",
        "Fraud Footprint",
        "fraud-footprint",
        "seon-email",
        "Email or phone",
        "Email and phone reputation, deliverability, and fraud signals.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "seon-email",
              label: "Email footprint",
              apiType: "seon-email",
            },
            {
              id: "seon-phone",
              label: "Phone footprint",
              apiType: "seon-phone",
            },
          ],
        },
      ),
      mod(
        "Identity",
        "Name Search",
        "name-search",
        "breach",
        "First and last name",
        "Search breach indexes by real name — or pivot into court and public registries.",
        undefined,
        undefined,
        {
          tools: [
            { id: "leak-indexes", label: "Leak indexes", apiType: "breach" },
            {
              id: "court-dockets",
              label: "Court dockets",
              apiType: "us-court",
            },
            {
              id: "public-identity",
              label: "Public identity",
              apiType: "us-identity",
            },
            {
              id: "va-sex-offender",
              label: "VA sex offender",
              apiType: "us-va-sor",
            },
            {
              id: "national-sor",
              label: "National SOR (NSOPW)",
              apiType: "us-sor-national",
            },
          ],
          optionalFilters: PERSON_GEO_FILTERS,
          lawfulUseNotice: true,
        },
      ),
      mod(
        "Identity",
        "Contact Enrich",
        "contact-enrich",
        "contact-enrich",
        "Name, email, phone, or address",
        "Validate and enrich contact records — names, phones, emails, and addresses.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),
    ],
  },
  {
    title: "Public Records",
    items: [
      mod(
        "Public Records",
        "Global Public Records",
        "global-public-records",
        "us-global",
        "John Doe, VA — or John Doe, GB",
        "Compose live US federal, state, sanctions, wanted, court, and international registry signals in one dossier.",
        undefined,
        undefined,
        { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
      ),
      mod(
        "Public Records",
        "Court Records",
        "court-records",
        "us-court",
        "John Doe, VA — or John Doe, DE — or a federal docket number",
        "Federal RECAP dockets, live Virginia OCIS, Delaware CourtConnect, Oklahoma OSCN party search, Hillsborough FL HOVER case lookup, and MD/TX/NY county portal routing when live automation is unavailable.",
        undefined,
        undefined,
        { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
      ),
      mod(
        "Public Records",
        "Identity Search",
        "identity-search",
        "us-identity",
        "John Doe, Fairfax County, VA — or Name, 22030",
        "Compose FEC, NPI, OFAC, UN sanctions, FBI/Interpol/DEA wanted, BOP inmate locator, NSOPW, state licenses (WA DOH / CalBar / TDLR when cued), and court indexes.",
        undefined,
        undefined,
        { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
      ),
      mod(
        "Public Records",
        "NPD Database Search",
        "npd-search",
        "us-npd",
        "Person name, optional state, county, ZIP, country, or DOB",
        "National/global people dossier composed from public government registries.",
        undefined,
        undefined,
        { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
      ),
      mod(
        "Public Records",
        "Sanctions & Watchlists",
        "sanctions-watchlists",
        "us-sanctions",
        "Person or entity name",
        "OFAC, UN consolidated sanctions, OpenSanctions, and SAM.gov federal exclusions.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),
      mod(
        "Public Records",
        "Wanted Persons",
        "wanted-persons",
        "us-wanted",
        "First and last name",
        "FBI wanted posters, Interpol Red Notices, DEA fugitives, and Dallas County wanted / delinquent lookup.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),
      mod(
        "Public Records",
        "National Sex Offender Registry",
        "national-sor",
        "us-sor-national",
        "John Smith — or John Smith, VA — or ZIP 23220",
        "Live NSOPW national search across US states & territories (got-scraping twin), plus Canada RCMP high-risk child SOR in parallel. Optional state/city/county/ZIP narrows US results; leave blank for open-ended. Runs Virginia/Florida state twins when those cues are present.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "nsopw-national",
              label: "NSOPW national",
              apiType: "us-sor-national",
            },
            {
              id: "va-sex-offender",
              label: "VA registry",
              apiType: "us-va-sor",
            },
          ],
          optionalFilters: PERSON_GEO_FILTERS,
          lawfulUseNotice: true,
        },
      ),
      mod(
        "Public Records",
        "VA Sex Offender Registry",
        "va-sex-offender",
        "us-va-sor",
        "John Smith, Fairfax County, VA — or John Smith, 22030",
        "Live Virginia State Police registry plus NSOPW scoped to VA. Optional county/ZIP/city filters when known.",
        undefined,
        undefined,
        {
          optionalFilters: PERSON_GEO_FILTERS,
          lawfulUseNotice: true,
        },
      ),
      mod(
        "Public Records",
        "US State Records Directory",
        "state-records-directory",
        "us-state-directory",
        "John Doe — optional state code (e.g. TX)",
        "Official court and sex-offender registry portals for all 50 US states + DC, plus MD/FL/TX/NY county portals.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),
      mod(
        "Public Records",
        "Portal Adapter Backlog",
        "portal-backlog",
        "us-portal-backlog",
        "John Doe, FL — or John Doe, TX",
        "150+ prioritized government portals (courts, inmate, SOR, sanctions, corporate, warrants) queued for live adapters.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),
      mod(
        "Public Records",
        "International Records Directory",
        "international-records-directory",
        "us-intl-directory",
        "John Doe, GB — or country code",
        "Official court, business registry, and sanctions portal links for major countries.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
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
      mod(
        "Network",
        "Host Lookup",
        "shodan-host",
        "shodan-host",
        "IPv4 or IPv6 address",
        "Open ports, services, banners, and host metadata for an IP.",
      ),
      mod(
        "Network",
        "Site Pentest",
        "site-pentest",
        "site-pentest",
        "Domain or URL (e.g. example.com)",
        "Passive website hardening dashboard — selectable recon (DNS/TLS/headers/cookies/CT/paths/crawl/host exposure). XSS/SQLi/CMDi/traversal/brute stay desktop lab only.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "For authorized defensive security research and hardening reviews only. Run this against systems you own or have explicit written permission to assess. Passive recon only — no exploit payloads, brute force, or active attack probes.",
        },
      ),
    ],
  },
  {
    title: "Financial & Assets",
    items: [
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
    title: "Crypto Intel",
    items: [
      mod(
        "Crypto Intel",
        "Crypto Wallet",
        "crypto-wallet",
        "crypto-wallet",
        "Bitcoin (1/3/bc1), Litecoin (L/M/ltc1), Ethereum (0x…), or Solana address — wallet only",
        "Detects chain from address format. Live balance, tokens, and recent txs.",
      ),
      mod(
        "Crypto Intel",
        "Address Intel",
        "crypto-address",
        "crypto-address",
        "BTC / ETH / LTC / SOL wallet address",
        "Multi-explorer balance, recent txs, seed entity labels, and risk flags.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Authorized OSINT / compliance research only. Public blockchain data and a static seed label list — not commercial chain analytics. Do not use to facilitate sanctions evasion or crime.",
        },
      ),
      mod(
        "Crypto Intel",
        "Tx Deep Dive",
        "crypto-tx",
        "crypto-tx",
        "Ethereum 0x… hash, Bitcoin txid, or Solana signature",
        "Decode status, value, fee, counterparties, and seed labels for a transaction.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Authorized OSINT / compliance research only. Public blockchain data — not a substitute for legal or AML advice.",
        },
      ),
      mod(
        "Crypto Intel",
        "Risk Check",
        "crypto-risk",
        "crypto-risk",
        "Wallet or ETH token contract address",
        "Sanctions/mixer seed match + free ETH honeypot/token heuristics (GoPlus when available).",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Authorized compliance research only. Seed lists and free token APIs are limited — confirm sanctions against official SDN sources before acting.",
        },
      ),
      mod(
        "Crypto Intel",
        "Fund Flow",
        "crypto-flow",
        "crypto-flow",
        "BTC / ETH / LTC / SOL wallet address",
        "Basic 1-hop counterparties from recent txs — not multi-hop commercial tracing.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Authorized OSINT / compliance research only. Basic hop visualization from public explorers — not mixer bypass or criminal facilitation tooling.",
        },
      ),
      mod(
        "Crypto Intel",
        "Top Holders",
        "crypto-holders",
        "crypto-holders",
        "Token contract address",
        "Holder heatmaps and concentration analysis — roadmap.",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "CEX Flows",
        "crypto-cex-flows",
        "crypto-cex-flows",
        "Exchange or wallet address",
        "CEX deposit clustering and off-ramp signals — roadmap.",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "Social Narrative",
        "crypto-social",
        "crypto-social",
        "Token ticker or narrative keyword",
        "KOL wallets and FUD/FOMO signals — coming soon (no aggressive social scraping).",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "Bridge Monitor",
        "crypto-bridge",
        "crypto-bridge",
        "Bridge tx or chain pair",
        "Cross-chain bridge monitoring — roadmap.",
        undefined,
        true,
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
        "Discord ID",
        "Live profile, server memberships, linked accounts, and indexed leak records.",
      ),
      mod(
        "Platforms",
        "HWID",
        "hwid",
        "breachhub",
        "Hardware ID / HWID string",
        "Pivot stealer and leak indexes by hardware identifier.",
      ),
      mod(
        "Platforms",
        "Facebook ID",
        "facebook-id",
        "breachhub",
        "Facebook profile ID or linked email",
        "Lookup Facebook profile IDs across breach and OSINT indexes.",
      ),
      mod(
        "Platforms",
        "Passport",
        "passport",
        "breachhub",
        "Passport number or document ID",
        "Search leak indexes for passport / document identifiers.",
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
        "Discord → Roblox",
        "oathnet-roblox",
        "oathnet-roblox",
        "Discord ID",
        "Resolve the Roblox account linked to a Discord user ID.",
      ),
      mod(
        "Platforms",
        "Minecraft",
        "minecraft",
        "minecraft",
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
        "breachhub",
        "Gamertag or Xbox ID",
        "Xbox gamertag and profile intelligence.",
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
        "Google Docs Intel",
        "google-docs",
        "breachhub",
        "Google Docs / Drive URL",
        "Extract metadata and exposure signals from Google Docs links.",
      ),
      mod(
        "Platforms",
        "Ganknow",
        "ganknow",
        "breachhub",
        "Ganknow username",
        "Lookup Ganknow gaming profiles via intelligence indexes.",
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
        "Twitter",
        "twitter",
        "breach",
        "X / Twitter user or profile link",
        "X and legacy Twitter username search.",
      ),
      mod(
        "Platforms",
        "Instagram",
        "instagram",
        "instagram",
        "Instagram user or profile link",
        "Profile intel plus follower and following list export.",
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
        "TikTok Recon",
        "tiktok-recon",
        "tiktok-recon",
        "TikTok @username or profile URL",
        "Live TikTok profile, stats, bio, region, and account metadata.",
      ),
      mod(
        "Platforms",
        "Share Resolver",
        "share-resolver",
        "share-resolver",
        "Instagram reel share (?igsh=) or TikTok short link",
        "Identify who shared an Instagram reel or TikTok video from the share URL.",
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
        "FiveM server intel via linked Discord ID.",
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
        "Tinder Live",
        "tinder-live",
        "tinder-live",
        "40.7128,-74.0060 ageMin=22 ageMax=35 distanceKm=40 gender=1",
        "Live Tinder recommendations via operator session — apply age, distance, gender, and Passport location filters.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Tinder Live uses a company-operated Tinder session. Authorized investigative use only. Do not scrape, harass, or store profiles beyond case need. Tinder ToS and local law still apply.",
        },
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

  const moduleDef = MODULE_BY_SLUG.get(slug.toLowerCase());

  if (moduleDef && isCryptoIntelSlug(moduleDef.slug) && !isCryptoIntelEnabled()) {
    return undefined;
  }

  if (moduleDef && isTinderLiveSlug(moduleDef.slug) && !isTinderLiveEnabled()) {
    return undefined;
  }

  return moduleDef;
}

export function getSearchModuleHint(
  itemName: string | null,
): string | undefined {
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
  "crypto-address": "crypto-address",
  "crypto-tx": "crypto-tx",
  "crypto-risk": "crypto-risk",
  "crypto-flow": "crypto-flow",
  "bin-lookup": "bin",
  "iban-check": "iban",
  "bank-search": "bank",
  "vin-decoder": "vin",
  "car-insurance-us": "car-insurance",
  "healthcare-us": "healthcare",
  "court-records": "us-court",
  "identity-search": "us-identity",
  "npd-search": "us-npd",
  "va-sex-offender": "us-va-sor",
  "global-public-records": "us-global",
  "sanctions-watchlists": "us-sanctions",
  "wanted-persons": "us-wanted",
  "national-sor": "us-sor-national",
  "state-records-directory": "us-state-directory",
  "portal-backlog": "us-portal-backlog",
  "international-records-directory": "us-intl-directory",
  "discord-id": "discord",
  roblox: "roblox",
  reddit: "reddit",
  minecraft: "minecraft",
  fivem: "fivem",
  domain: "domains",
  "hash-lookup": "breach",
  "password-search": "breach",
  "name-search": "breach",
  "email-analyze": "email-analyze",
  "fraud-footprint": "seon-email",
  "seon-email": "seon-email",
  "seon-phone": "seon-phone",
  breachbase: "breaches",
  "oathnet-roblox": "oathnet-roblox",
  "contact-enrich": "contact-enrich",
  "shodan-host": "shodan-host",
  "site-pentest": "site-pentest",
  "tiktok-recon": "tiktok-recon",
  "share-resolver": "share-resolver",
  "account-finder": "username-accounts",
  ip: "ip",
  intelx: "intelx",
  "stealer-logs": "breach",
  phone: "breach",
  username: "breach",
  steam: "breach",
  xbox: "breachhub",
  "google-docs": "breachhub",
  ganknow: "breachhub",
  hwid: "breachhub",
  "facebook-id": "breachhub",
  passport: "breachhub",
  telegram: "breachhub",
  instagram: "instagram",
  snapchat: "breachhub",
  tiktok: "breach",
  twitter: "breachhub",
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
  const cryptoEnabled = isCryptoIntelEnabled();
  const cryptoSection = SEARCH_MODULE_SECTIONS.find(
    (section) => section.title === CRYPTO_INTEL_SECTION_TITLE,
  );
  const cryptoWallet = cryptoSection?.items.find(
    (item) => item.slug === "crypto-wallet",
  );
  const cryptoSuiteItems =
    cryptoSection?.items.filter((item) => item.slug !== "crypto-wallet") ?? [];
  const cryptoAi = AI_SEARCH_MODULES.find((item) => item.slug === "crypto-ai");

  const withSection = (
    item: SearchModuleDef,
    section: string,
  ): SearchModuleDef =>
    item.section === section ? item : { ...item, section };

  const aiItems = cryptoEnabled
    ? AI_SEARCH_MODULES.filter((item) => item.slug !== "crypto-ai").map(
        (item) => withSection(item, CRYPTO_AI_FALLBACK_SECTION),
      )
    : AI_SEARCH_MODULES.map((item) =>
        withSection(item, CRYPTO_AI_FALLBACK_SECTION),
      );

  const sections: SearchModuleSection[] = [
    { title: "AI Intelligence", items: aiItems },
  ];

  for (const section of SEARCH_MODULE_SECTIONS) {
    if (section.title === CRYPTO_INTEL_SECTION_TITLE) {
      if (!cryptoEnabled) continue;

      const items: SearchModuleDef[] = [];

      if (cryptoWallet) {
        items.push(withSection(cryptoWallet, CRYPTO_INTEL_SECTION_TITLE));
      }
      if (cryptoAi) {
        items.push(withSection(cryptoAi, CRYPTO_INTEL_SECTION_TITLE));
      }
      for (const item of cryptoSuiteItems) {
        items.push(withSection(item, CRYPTO_INTEL_SECTION_TITLE));
      }

      sections.push({ title: CRYPTO_INTEL_SECTION_TITLE, items });
      continue;
    }

    if (section.title === "Dating Apps") {
      const items = section.items.filter(
        (item) => !(isTinderLiveSlug(item.slug) && !isTinderLiveEnabled()),
      );

      sections.push({ title: section.title, items });
      continue;
    }

    if (section.title === CRYPTO_WALLET_FALLBACK_SECTION) {
      if (!cryptoEnabled && cryptoWallet) {
        sections.push({
          title: section.title,
          items: [
            withSection(cryptoWallet, CRYPTO_WALLET_FALLBACK_SECTION),
            ...section.items,
          ],
        });
      } else {
        sections.push(section);
      }
      continue;
    }

    sections.push(section);
  }

  return sections;
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
  "email-analyze": true,
  "fraud-footprint": true,
  breachbase: true,
  "oathnet-roblox": true,
  "contact-enrich": true,
  "crypto-wallet": true,
  "crypto-address": true,
  "crypto-tx": true,
  "crypto-risk": true,
  "crypto-flow": true,
  "crypto-holders": false,
  "crypto-cex-flows": false,
  "crypto-social": false,
  "crypto-bridge": false,
  "bin-lookup": true,
  "iban-check": true,
  "bank-search": true,
  "vin-decoder": true,
  "car-insurance-us": true,
  "healthcare-us": true,
  "court-records": true,
  "identity-search": true,
  "npd-search": true,
  "va-sex-offender": true,
  "global-public-records": true,
  "sanctions-watchlists": true,
  "wanted-persons": true,
  "national-sor": true,
  "state-records-directory": true,
  "international-records-directory": true,
  "discord-id": true,
  roblox: true,
  minecraft: true,
  steam: true,
  xbox: true,
  hwid: true,
  "facebook-id": true,
  passport: true,
  "google-docs": true,
  ganknow: true,
  playstation: false,
  telegram: true,
  instagram: true,
  snapchat: true,
  tiktok: true,
  "tiktok-recon": true,
  "share-resolver": true,
  twitter: true,
  reddit: true,
  github: true,
  fivem: true,
  "shodan-host": true,
  "site-pentest": true,
  tinder: true,
  "tinder-live": true,
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
