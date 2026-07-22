import {
  CRYPTO_INTEL_LEGACY_TOOL_BY_SLUG,
  CRYPTO_INTEL_SECTION_TITLE,
  CRYPTO_INTEL_UNIFIED_SLUG,
  isCryptoIntelEnabled,
  isCryptoIntelSlug,
} from "@/lib/crypto-intel/enabled";
import {
  isHingeLiveEnabled,
  isHingeLiveSlug,
} from "@/lib/hinge-live/enabled";
import {
  isTinderLiveEnabled,
  isTinderLiveSlug,
} from "@/lib/tinder-live/enabled";

const CRYPTO_WALLET_FALLBACK_SECTION = "Financial & Assets";
const CRYPTO_AI_FALLBACK_SECTION = "AI Intelligence";

/** Legacy crypto sidebar slugs folded into unified Crypto Intel. */
export const CRYPTO_INTEL_LEGACY_REDIRECT_SLUGS = new Set(
  Object.keys(CRYPTO_INTEL_LEGACY_TOOL_BY_SLUG),
);

/**
 * Duplicate intent modules folded into one primary search surface.
 * Old URLs redirect to the primary slug (optional `?tool=`).
 */
export const INTENT_UNIFIED_REDIRECTS: Record<
  string,
  { slug: string; tool?: string }
> = {
  "account-finder": { slug: "username", tool: "account-finder" },
  "handle-sweep": { slug: "username", tool: "handle-sweep" },
  "phone-index": { slug: "phone", tool: "phone-index" },
  ipinfo: { slug: "ip", tool: "ipinfo" },
  "seekria-ip": { slug: "ip", tool: "seekria-ip" },
  "seekria-discord": { slug: "discord-id" },
  "seekria-roblox": { slug: "roblox", tool: "seekria-roblox" },
  "seekria-footprint": { slug: "username", tool: "seekria-footprint" },
  "seekria-fivem": { slug: "fivem", tool: "seekria-fivem" },
  "seekria-minecraft": { slug: "minecraft", tool: "seekria-minecraft" },
  "seekria-domain": { slug: "domain", tool: "seekria-domain" },
  "seekria-breaches": { slug: "breaches", tool: "seekria-email-breach" },
  "oathnet-roblox": { slug: "discord-id", tool: "discord-to-roblox" },
  melissa: { slug: "contact-enrich", tool: "melissa" },
  /** Stealer-only vendors — never standalone hubs; fold into All stealer indexes. */
  "seeknow-stealer": { slug: "stealer-logs", tool: "all-stealers" },
  wentyn: { slug: "stealer-logs", tool: "all-stealers" },
  /** Breach specialty vendors fold into Breaches chips. */
  "seeknow-search": { slug: "breaches", tool: "seeknow-search" },
  leaksight: { slug: "breaches", tool: "leaksight" },
  inf0sec: { slug: "breaches", tool: "inf0sec" },
};

/** Sidebar hides these — they remain in the catalog for redirects / deep links. */
export const INTENT_HUB_HIDDEN_SLUGS = new Set(
  Object.keys(INTENT_UNIFIED_REDIRECTS),
);

export function getIntentUnifiedRedirect(
  slug: string | null | undefined,
): { slug: string; tool?: string } | null {
  if (!slug) return null;

  return INTENT_UNIFIED_REDIRECTS[slug.toLowerCase()] ?? null;
}

export type ModuleTool = {
  id: string;
  label: string;
  /** OSINT API segment used when this tool is selected. */
  apiType: string;
  /** When set, routes through /api/osint/ai with this mode. */
  aiMode?: string;
};

/** Optional narrowing fields â€” empty means open-ended search. */
export type ModuleOptionalFilter = {
  id: "state" | "city" | "county" | "zip" | "dob";
  label: string;
  placeholder: string;
};

/**
 * Module catalog entry. Pages render via `ModuleSearchView`, which always
 * shows the shared Intel Signal Lattice loader while a run is in flight â€”
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
    | "tools"
    | "optionalFilters"
    | "lawfulUseNotice"
    | "lawfulUseCopy"
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
    "Any target â€” cross-source AI synthesis",
    "Cross-source AI synthesis â€” breach, network, and social signals in one brief.",
    "search",
  ),
  mod(
    "AI Intelligence",
    "AI Deep Scan",
    "ai-deep-scan",
    "ai",
    "Email, IP, domain, username, or Discord ID",
    "Maximum-depth pass â€” every relevant index queried in parallel.",
    "deep",
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
        "stealer",
        "IP, email, or domain",
        "One stealer search — SeekNow, Wentyn, DataVoid, OathNet, Hudson Rock, OsintCat, BreachHub, and COMB indexes in a single fan-out.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "all-stealers",
              label: "All stealer indexes",
              apiType: "stealer",
            },
          ],
        },
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
        "Unified breach search â€” Comb, Breach Index, and every connected leak provider in one module.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "all-breaches",
              label: "All breach indexes",
              apiType: "breaches",
            },
            {
              id: "seeknow-search",
              label: "SeekNow search",
              apiType: "seeknow/search",
            },
            {
              id: "leaksight",
              label: "LeakSight",
              apiType: "leaksight",
            },
            {
              id: "inf0sec",
              label: "Inf0sec leaks",
              apiType: "inf0sec",
            },
            {
              id: "nosint-search",
              label: "Nosint search",
              apiType: "nosint/search",
            },
            {
              id: "oathnet-breach",
              label: "OathNet breach",
              apiType: "oathnet/breach",
            },
            {
              id: "oathnet-holehe",
              label: "OathNet Holehe",
              apiType: "oathnet/holehe",
            },
            {
              id: "oathnet-ghunt",
              label: "OathNet GHunt",
              apiType: "oathnet/ghunt",
            },
            {
              id: "seekria-email-breach",
              label: "Seekria email breach",
              apiType: "seekria/email-breach",
            },
            {
              id: "seekria-username-breach",
              label: "Seekria username breach",
              apiType: "seekria/username-breach",
            },
            {
              id: "seekria-phone-breach",
              label: "Seekria phone breach",
              apiType: "seekria/phone-breach",
            },
            {
              id: "seekria-snusbase-breach",
              label: "Snusbase (via Seekria)",
              apiType: "seekria/snusbase-breach",
            },
            {
              id: "seekria-leakcheck-breach",
              label: "LeakCheck (via Seekria)",
              apiType: "seekria/leakcheck-breach",
            },
            {
              id: "seekria-tiktok-breach",
              label: "Seekria TikTok breach",
              apiType: "seekria/tiktok-breach",
            },
          ],
        },
      ),
      mod(
        "Breach & Leaks",
        "Hash Lookup",
        "hash-lookup",
        "breach",
        "MD5, SHA-1, SHA-256, or other hash",
        "Pivot breach indexes by password or file hash.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "all-indexes",
              label: "All indexes",
              apiType: "breach",
            },
            {
              id: "hash-database",
              label: "Hash database",
              apiType: "snusbase/hash-lookup",
            },
          ],
        },
      ),
      mod(
        "Breach & Leaks",
        "Combo Lookup",
        "combo-lookup",
        "snusbase/combo-lookup",
        "Username, email, or password",
        "Search combolist indexes for credential pairs.",
      ),
      mod(
        "Breach & Leaks",
        "Credential Index",
        "snusbase",
        "snusbase",
        "Email, username, IP, hash, or password",
        "Search the primary credential breach index.",
      ),
      // Legacy — hidden from hub; redirects to Breaches?tool=seeknow-search
      mod(
        "Breach & Leaks",
        "SeekNow Search",
        "seeknow-search",
        "seeknow/search",
        "Email, phone, username, IP, or hash",
        "Merged into Breaches — available as the SeekNow search tool chip.",
      ),
      // Legacy — hidden from hub; redirects to Stealer Logs (All stealer indexes)
      mod(
        "Breach & Leaks",
        "SeekNow Stealer",
        "seeknow-stealer",
        "seeknow/stealer",
        "Email, username, or domain",
        "Merged into Stealer Logs — covered by All stealer indexes fan-out.",
      ),
      // Legacy — hidden from hub; redirects to Stealer Logs (All stealer indexes)
      mod(
        "Breach & Leaks",
        "Wentyn",
        "wentyn",
        "wentyn",
        "Email or domain",
        "Merged into Stealer Logs — covered by All stealer indexes fan-out.",
      ),
      // Legacy — hidden from hub; redirects to Breaches?tool=leaksight
      mod(
        "Breach & Leaks",
        "LeakSight",
        "leaksight",
        "leaksight",
        "Email, username, phone, IP, domain, or URL",
        "Merged into Breaches — available as the LeakSight tool chip.",
      ),
      // Legacy — hidden from hub; redirects to Breaches?tool=inf0sec
      mod(
        "Breach & Leaks",
        "Inf0sec",
        "inf0sec",
        "inf0sec",
        "Email, username, phone, IP, domain, or Discord ID",
        "Merged into Breaches — available as the Inf0sec leaks tool chip.",
      ),
      mod(
        "Breach & Leaks",
        "DataVoid",
        "datavoid",
        "datavoid/recovery",
        "Email, username, phone, name, or company",
        "DataVoid people and company recovery (US/CA/IL). Stealer, Discord, Roblox, and other specialties live on their primary hubs.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "recovery",
              label: "Recovery",
              apiType: "datavoid/recovery",
            },
            { id: "us", label: "US people", apiType: "datavoid/us" },
            { id: "ca", label: "Canada people", apiType: "datavoid/ca" },
            { id: "il", label: "Israel people", apiType: "datavoid/il" },
            {
              id: "company",
              label: "Company",
              apiType: "datavoid/company",
            },
          ],
        },
      ),
      // Legacy — hidden from hub; redirects to Breaches?tool=seekria-email-breach
      mod(
        "Breach & Leaks",
        "Seekria Breaches",
        "seekria-breaches",
        "seekria/email-breach",
        "Email, username, or phone",
        "Merged into Breaches — Seekria breach indexes are tool chips on the primary Breaches hub.",
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
        "AI breach brief â€” exposure, platforms, credential risk, and domain intel.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "ai-brief",
              label: "AI brief",
              apiType: "email-analyze",
            },
            {
              id: "email-presence",
              label: "Contact Profiles",
              apiType: "email-presence",
            },
            {
              id: "index-sweep",
              label: "Index Sweep",
              apiType: "index-sweep",
            },
            {
              id: "seekria-email-osint",
              label: "Seekria email OSINT",
              apiType: "seekria/email-osint",
            },
            {
              id: "seeknow-email-check",
              label: "SeekNow email check",
              apiType: "seeknow/network/email-check",
            },
          ],
        },
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
        "Detected automatically â€” enter any phone format",
        "Drop a number â€” format is detected and the lookup is routed automatically.",
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
              id: "phone-index",
              label: "Phone Index",
              apiType: "index-sweep",
            },
            {
              id: "seeknow-phone",
              label: "SeekNow phone",
              apiType: "seeknow/network/phone",
            },
            {
              id: "seekria-phone-breach",
              label: "Seekria phone breach",
              apiType: "seekria/phone-breach",
            },
          ],
        },
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
            {
              id: "handle-sweep",
              label: "Handle Sweep",
              apiType: "handle-sweep",
            },
            {
              id: "seeknow-social",
              label: "SeekNow social",
              apiType: "seeknow/username/social",
            },
            {
              id: "seeknow-history",
              label: "SeekNow history",
              apiType: "seeknow/username/history",
            },
            {
              id: "seekria-footprint",
              label: "Seekria footprint",
              apiType: "seekria/user-footprint",
            },
          ],
        },
      ),
      mod(
        "Identity",
        "Account Finder",
        "account-finder",
        "username-accounts",
        "Username — Web Profiles + Handle Sweep",
        "Merged into Username — available as the Account finder tool chip.",
      ),
      mod(
        "Identity",
        "Handle Sweep",
        "handle-sweep",
        "handle-sweep",
        "Username — deep public profile sweep",
        "Merged into Username — available as the Handle Sweep tool chip.",
      ),
      mod(
        "Identity",
        "Contact Profiles",
        "email-presence",
        "email-presence",
        "Email or phone number",
        "Check whether an email or phone has accounts across social, dating, adult, commerce, and media sites â€” then surface a username/profile URL when a platform still leaks one. Dating apps (Tinder/Hinge/Bumble) no longer expose public registration checks.",
      ),
      mod(
        "Identity",
        "Index Sweep",
        "index-sweep",
        "index-sweep",
        'Email or phone â€” strict "id" site: operators',
        'Strict quoted search operators across LinkedIn, GitHub, and other public indexed platforms. Loose leads stay low confidence unless corroborated.',
      ),
      mod(
        "Identity",
        "Phone Index",
        "phone-index",
        "index-sweep",
        "Phone — every format variant, strict quoted search",
        "Merged into Phone — available as the Phone Index tool chip.",
      ),
      mod(
        "Identity",
        "Fraud Footprint",
        "fraud-footprint",
        "seon/email",
        "Email, phone, IP, or BIN",
        "Email, phone, IP, and BIN reputation, deliverability, and fraud signals.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "seon-email",
              label: "Email footprint",
              apiType: "seon/email",
            },
            {
              id: "seon-phone",
              label: "Phone footprint",
              apiType: "seon/phone",
            },
            { id: "seon-email-verification", label: "Email verification", apiType: "seon/email-verification" },
            { id: "seon-ip", label: "IP footprint", apiType: "seon/ip" },
            { id: "seon-bin", label: "BIN lookup", apiType: "seon/bin" },
            {
              id: "index-sweep",
              label: "Index Sweep",
              apiType: "index-sweep",
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
        "Search breach indexes by real name â€” or pivot into court and public registries.",
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
        "Validate and enrich contact records â€” names, phones, emails, and addresses.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          tools: [
            {
              id: "contact-enrich",
              label: "Contact enrich",
              apiType: "contact-enrich",
            },
            {
              id: "melissa",
              label: "Melissa lookup",
              apiType: "melissa",
            },
          ],
        },
      ),
      // Legacy — hidden from hub; redirects to Contact Enrich?tool=melissa
      mod(
        "Identity",
        "Melissa Lookup",
        "melissa",
        "melissa",
        "Email, phone, IP, name, or address",
        "Merged into Contact Enrich — available as the Melissa lookup tool chip.",
        undefined,
        undefined,
        { lawfulUseNotice: true },
      ),

      mod(
        "Identity",
        "PropertyRadar",
        "propertyradar",
        "propertyradar/search",
        "Address, owner name, phone, or email",
        "Property and owner skip-trace â€” search properties, persons, phones, emails, and combined skip-trace.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          tools: [
            {
              id: "propertyradar-search",
              label: "Property search",
              apiType: "propertyradar/search",
            },
            {
              id: "propertyradar-persons",
              label: "Persons",
              apiType: "propertyradar/persons",
            },
            {
              id: "propertyradar-phone",
              label: "Phone",
              apiType: "propertyradar/phone",
            },
            {
              id: "propertyradar-email",
              label: "Email",
              apiType: "propertyradar/email",
            },
            {
              id: "propertyradar-skiptrace",
              label: "Skip-trace",
              apiType: "propertyradar/skiptrace",
            },
          ],
        },
      ),
    ],
  },
  {
    title: "Public Records",
    items: [
      mod(
        "Public Records",
        "Public Records",
        "public-records",
        "public-records",
        "First and last name â€” optional state, city, county, ZIP, or DOB",
        "One search across court, identity, sanctions, wanted, sex-offender, state/international directories, breach indexes, and contact enrichment. Use Options next to Search to toggle sources (all on by default).",
        undefined,
        undefined,
        { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
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
        undefined,
        undefined,
        {
          tools: [
            { id: "ip-indexes", label: "IP indexes", apiType: "ip" },
            {
              id: "seeknow-ip",
              label: "SeekNow IP",
              apiType: "seeknow/network/ip",
            },
            {
              id: "ipinfo",
              label: "IPInfo",
              apiType: "ipinfo",
            },
            {
              id: "seekria-ip",
              label: "Seekria IP",
              apiType: "seekria/ip",
            },
            {
              id: "oathnet-ip",
              label: "OathNet IP",
              apiType: "oathnet/ip-info",
            },
            {
              id: "nosint-ip",
              label: "Nosint IP",
              apiType: "nosint/ip",
            },
            {
              id: "seon-ip",
              label: "SEON IP",
              apiType: "seon/ip",
            },
            {
              id: "datavoid-geocode",
              label: "DataVoid geocode",
              apiType: "datavoid/geocode",
            },
            {
              id: "datavoid-reverse-geocode",
              label: "DataVoid reverse geocode",
              apiType: "datavoid/reverse-geocode",
            },
          ],
        },
      ),
      mod(
        "Network",
        "Domain",
        "domain",
        "domains",
        "Domain name (e.g. example.com)",
        "Stealer logs, breach data, and domain intelligence pivots.",
        undefined,
        undefined,
        {
          tools: [
            { id: "domain-indexes", label: "Domain indexes", apiType: "domains" },
            {
              id: "seeknow-domain-intel",
              label: "SeekNow intel",
              apiType: "seeknow/domain/intel",
            },
            {
              id: "seeknow-domain-whois",
              label: "SeekNow WHOIS",
              apiType: "seeknow/domain/whois",
            },
            {
              id: "seekria-domain",
              label: "Seekria domain",
              apiType: "seekria/domain-lookup",
            },
            {
              id: "seekria-dns",
              label: "Seekria DNS",
              apiType: "seekria/dns-resolver",
            },
            {
              id: "oathnet-extract-subdomain",
              label: "OathNet subdomain extract",
              apiType: "oathnet/extract-subdomain",
            },
          ],
        },
      ),
      mod(
        "Network",
        "Host Lookup",
        "shodan-host",
        "shodan-host",
        "IPv4 or IPv6 address",
        "Open ports, services, banners, and host metadata for an IP.",
        undefined,
        undefined,
        {
          tools: [
            { id: "host", label: "Host", apiType: "shodan/host" },
            { id: "search", label: "Search", apiType: "shodan/search" },
            { id: "dns", label: "DNS", apiType: "shodan/dns" },
            {
              id: "dns-resolve",
              label: "DNS resolve",
              apiType: "shodan/dns/resolve",
            },
            {
              id: "dns-reverse",
              label: "DNS reverse",
              apiType: "shodan/dns/reverse",
            },
            {
              id: "honeyscore",
              label: "Honeyscore",
              apiType: "shodan/honeyscore",
            },
          ],
        },
      ),
      // Legacy — hidden from hub; redirects to IP?tool=ipinfo
      mod(
        "Network",
        "IPInfo",
        "ipinfo",
        "ipinfo",
        "IPv4 or IPv6 address",
        "Merged into IP — available as the IPInfo tool chip.",
      ),
      mod(
        "Network",
        "IP WHOIS",
        "ip-whois",
        "snusbase/ip-whois",
        "IPv4 or IPv6 address",
        "WHOIS and network registration details for an IP address.",
      ),
      mod(
        "Network",
        "Site Pentest",
        "site-pentest",
        "site-pentest",
        "Domain or URL (e.g. example.com)",
        "Passive website hardening dashboard â€” selectable recon (DNS/TLS/headers/cookies/CT/paths/crawl/host exposure). XSS/SQLi/CMDi/traversal/brute stay desktop lab only.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "For authorized defensive security research and hardening reviews only. Run this against systems you own or have explicit written permission to assess. Passive recon only â€” no exploit payloads, brute force, or active attack probes.",
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
        "First 6â€“8 digits of a card number",
        "Identify issuing bank, card type, brand, and country from a BIN.",
        undefined,
        undefined,
        {
          tools: [
            { id: "bin-osint", label: "BIN indexes", apiType: "bin" },
            { id: "binlist", label: "Binlist", apiType: "binlist" },
            { id: "seon-bin", label: "SEON BIN", apiType: "seon/bin" },
          ],
        },
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
        "Search US FDIC-insured institutions â€” metadata only, not account balances.",
      ),
      mod(
        "Financial & Assets",
        "Checko",
        "checko",
        "checko",
        "INN, OGRN, or OKPO",
        "Russian company registry (EGRUL) lookup by tax ID (INN), OGRN, or OKPO.",
      ),
      mod(
        "Financial & Assets",
        "VIN Decoder US",
        "vin-decoder",
        "vin",
        "17-character vehicle VIN",
        "Decode make, model, year, and specs via NHTSA.",
        undefined,
        undefined,
        {
          tools: [
            { id: "vin-nhtsa", label: "NHTSA decode", apiType: "vin" },
            {
              id: "datavoid-automotive",
              label: "DataVoid automotive",
              apiType: "datavoid/automotive",
            },
            {
              id: "datavoid-automotive-check",
              label: "DataVoid automotive check",
              apiType: "datavoid/automotive/check",
            },
          ],
        },
      ),
      mod(
        "Financial & Assets",
        "Car Insurance US",
        "car-insurance-us",
        "car-insurance",
        "Insurer name, keyword, or US state code",
        "Search major US auto insurers â€” State Farm, GEICO, Progressive, and more.",
      ),
      mod(
        "Financial & Assets",
        "Health Care US",
        "healthcare-us",
        "healthcare",
        "Plan name, keyword, or US state code",
        "Search US health insurers and systems â€” UnitedHealthcare, Aetna, Kaiser, and more.",
      ),
    ],
  },
  {
    title: "Crypto Intel",
    items: [
      mod(
        "Crypto Intel",
        "Crypto Intel",
        "crypto-intel",
        "crypto-full",
        "Wallet or tx hash â€” chain auto-detected (BTC / ETH / LTC / SOL)",
        "Unified crypto suite: full intel, wallet balance, address labels, risk, fund flow, tx deep dive, and Crypto AI.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Authorized OSINT / compliance research only. Public blockchain data and a static seed label list â€” not commercial chain analytics. Do not use to facilitate sanctions evasion or crime.",
          tools: [
            {
              id: "full",
              label: "Full intel",
              apiType: "crypto-full",
            },
            {
              id: "wallet",
              label: "Wallet",
              apiType: "crypto-wallet",
            },
            {
              id: "address",
              label: "Address intel",
              apiType: "crypto-address",
            },
            {
              id: "risk",
              label: "Risk check",
              apiType: "crypto-risk",
            },
            {
              id: "flow",
              label: "Fund flow",
              apiType: "crypto-flow",
            },
            {
              id: "tx",
              label: "Tx deep dive",
              apiType: "crypto-tx",
            },
            {
              id: "ai",
              label: "Crypto AI",
              apiType: "ai",
              aiMode: "crypto",
            },
          ],
        },
      ),
      mod(
        "Crypto Intel",
        "Top Holders",
        "crypto-holders",
        "crypto-holders",
        "Token contract address",
        "Holder heatmaps and concentration analysis â€” roadmap.",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "CEX Flows",
        "crypto-cex-flows",
        "crypto-cex-flows",
        "Exchange or wallet address",
        "CEX deposit clustering and off-ramp signals â€” roadmap.",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "Social Narrative",
        "crypto-social",
        "crypto-social",
        "Token ticker or narrative keyword",
        "KOL wallets and FUD/FOMO signals â€” coming soon (no aggressive social scraping).",
        undefined,
        true,
      ),
      mod(
        "Crypto Intel",
        "Bridge Monitor",
        "crypto-bridge",
        "crypto-bridge",
        "Bridge tx or chain pair",
        "Cross-chain bridge monitoring â€” roadmap.",
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
        "One Discord ID search — live profile plus SeekNow, Seekria, Reconly, CordCat, OathNet, and leak indexes in a single fan-out.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "discord-live",
              label: "Discord OSINT",
              apiType: "discord",
            },
            {
              id: "discord-history",
              label: "Username history",
              apiType: "discord/history",
            },
            {
              id: "discord-export",
              label: "Export pack",
              apiType: "discord/export",
            },
            {
              id: "discord-id-decode",
              label: "ID decode",
              apiType: "discord/snowflake",
            },
            {
              id: "discord-to-roblox",
              label: "Discord → Roblox",
              apiType: "oathnet-roblox",
            },
            {
              id: "datavoid-discord",
              label: "DataVoid Discord",
              apiType: "datavoid/discord",
            },
            {
              id: "oathnet-discord-userinfo",
              label: "OathNet userinfo",
              apiType: "oathnet/discord-userinfo",
            },
            {
              id: "oathnet-discord-history",
              label: "OathNet username history",
              apiType: "oathnet/discord-username-history",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Reconly",
        "reconly",
        "reconly",
        "Username, email, or FiveM identifier",
        "Reconly username, email, and FiveM lookups (Discord ID runs via Discord OSINT).",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "reconly-auto",
              label: "Auto detect",
              apiType: "reconly",
            },
            {
              id: "reconly-fivem",
              label: "FiveM",
              apiType: "reconly",
            },
          ],
        },
      ),
      // Legacy catalog entries — hidden from hub; URLs redirect to primary intents.
      mod(
        "Platforms",
        "Seekria Discord",
        "seekria-discord",
        "seekria/discord",
        "Discord snowflake ID",
        "Merged into Discord ID — Seekria fans out with the main Discord OSINT search.",
      ),
      mod(
        "Platforms",
        "Seekria Roblox",
        "seekria-roblox",
        "seekria/roblox",
        "Roblox username",
        "Merged into Roblox — available as a tool chip on the primary Roblox search.",
      ),
      mod(
        "Platforms",
        "Seekria Minecraft",
        "seekria-minecraft",
        "seekria/minecraft",
        "Minecraft username or UUID",
        "Merged into Minecraft — Seekria tools are chips on the primary Minecraft hub.",
      ),
      // Legacy — hidden from hub; redirects to FiveM?tool=seekria-fivem
      mod(
        "Platforms",
        "Seekria FiveM",
        "seekria-fivem",
        "seekria/fivem",
        "Username, IP, Discord ID, license, Steam, or UUID",
        "Merged into FiveM — available as the Seekria FiveM tool chip.",
      ),
      mod(
        "Platforms",
        "Seekria IP",
        "seekria-ip",
        "seekria/ip",
        "IPv4 address",
        "Merged into IP — available as the Seekria IP tool chip.",
      ),
      // Legacy — hidden from hub; redirects to Domain?tool=seekria-domain
      mod(
        "Platforms",
        "Seekria Domain",
        "seekria-domain",
        "seekria/domain-lookup",
        "Domain name",
        "Merged into Domain — available as Seekria domain / DNS tool chips.",
      ),
      // Legacy — hidden from hub; redirects to Username?tool=seekria-footprint
      mod(
        "Platforms",
        "Seekria Footprint",
        "seekria-footprint",
        "seekria/user-footprint",
        "Username",
        "Merged into Username — available as the Seekria footprint tool chip.",
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
        "LATAM Country DB",
        "notalivex-country",
        "notalivex/mx/email",
        "Email, phone, name, or national ID",
        "NotAliveX country breach databases (MX, AR, BR, CL, and more).",
        undefined,
        undefined,
        {
          tools: [
            { id: "mx-email", label: "MX Â· email", apiType: "notalivex/mx/email" },
            {
              id: "mx-telefono",
              label: "MX Â· telÃ©fono",
              apiType: "notalivex/mx/telefono",
            },
            { id: "mx-curp", label: "MX Â· CURP", apiType: "notalivex/mx/curp" },
            { id: "mx-rfc", label: "MX Â· RFC", apiType: "notalivex/mx/rfc" },
            {
              id: "mx-nombre",
              label: "MX Â· nombre",
              apiType: "notalivex/mx/nombre",
            },
            { id: "ar-email", label: "AR Â· email", apiType: "notalivex/ar/email" },
            { id: "ar-dni", label: "AR Â· DNI", apiType: "notalivex/ar/dni" },
            {
              id: "ar-telefono",
              label: "AR Â· telÃ©fono",
              apiType: "notalivex/ar/telefono",
            },
            {
              id: "ar-nombre",
              label: "AR Â· nombre",
              apiType: "notalivex/ar/nombre",
            },
            { id: "br-email", label: "BR Â· email", apiType: "notalivex/br/email" },
            { id: "br-cpf", label: "BR Â· CPF", apiType: "notalivex/br/cpf" },
            { id: "br-fone", label: "BR Â· fone", apiType: "notalivex/br/fone" },
            { id: "cl-email", label: "CL Â· email", apiType: "notalivex/cl/email" },
            { id: "cl-rut", label: "CL Â· RUT", apiType: "notalivex/cl/rut" },
            {
              id: "cl-telefono",
              label: "CL Â· telÃ©fono",
              apiType: "notalivex/cl/telefono",
            },
            { id: "co-email", label: "CO Â· email", apiType: "notalivex/co/email" },
            {
              id: "co-cedula",
              label: "CO Â· cÃ©dula",
              apiType: "notalivex/co/cedula",
            },
            { id: "pe-email", label: "PE Â· email", apiType: "notalivex/pe/email" },
            { id: "us-email", label: "US Â· email", apiType: "notalivex/us/email" },
            { id: "es-email", label: "ES Â· email", apiType: "notalivex/es/email" },
          ],
        },
      ),
      mod(
        "Platforms",
        "NotAliveX Social",
        "notalivex-platform",
        "notalivex/tg/username",
        "Username, phone, email, or Telegram ID",
        "NotAliveX Telegram, Instagram, and social OSINT indexes.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "tg-username",
              label: "Telegram Â· username",
              apiType: "notalivex/tg/username",
            },
            {
              id: "tg-id",
              label: "Telegram Â· ID",
              apiType: "notalivex/tg/id",
            },
            {
              id: "tg-phone",
              label: "Telegram Â· phone",
              apiType: "notalivex/tg/telefono",
            },
            {
              id: "ig-username",
              label: "Instagram Â· username",
              apiType: "notalivex/instagram/username",
            },
            {
              id: "ig-email",
              label: "Instagram Â· email",
              apiType: "notalivex/instagram/email",
            },
            {
              id: "ig-phone",
              label: "Instagram Â· phone",
              apiType: "notalivex/instagram/telefono",
            },
            {
              id: "osint-social",
              label: "OSINT Â· social",
              apiType: "notalivex/osint/social",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "AR Renaper",
        "notalivex-renaper",
        "notalivex/ar_rena/renaper",
        "DNI and sex â€” e.g. 12345678 M",
        "Argentina RENAPER national registry lookup by DNI + sex (M/F).",
      ),
      mod(
        "Platforms",
        "Roblox",
        "roblox",
        "roblox",
        "Roblox username",
        "Lookup Roblox profiles and cross-platform links.",
        undefined,
        undefined,
        {
          tools: [
            { id: "roblox-indexes", label: "Leak indexes", apiType: "roblox" },
            {
              id: "nbrs-roblox",
              label: "NBRS Roblox",
              apiType: "nbrs/roblox",
            },
            {
              id: "seeknow-roblox",
              label: "SeekNow Roblox",
              apiType: "seeknow/gaming/roblox",
            },
            {
              id: "seekria-roblox",
              label: "Seekria Roblox",
              apiType: "seekria/roblox",
            },
            {
              id: "datavoid-roblox",
              label: "DataVoid Roblox",
              apiType: "datavoid/roblox",
            },
            {
              id: "oathnet-roblox-userinfo",
              label: "OathNet Roblox",
              apiType: "oathnet/roblox-userinfo",
            },
          ],
        },
      ),
      // Legacy — hidden from hub; redirects to Discord ID?tool=discord-to-roblox
      mod(
        "Platforms",
        "Discord → Roblox",
        "oathnet-roblox",
        "oathnet-roblox",
        "Discord ID",
        "Merged into Discord ID — available as the Discord → Roblox tool chip.",
      ),
      mod(
        "Platforms",
        "Minecraft",
        "minecraft",
        "minecraft",
        "Minecraft username or UUID",
        "Search Minecraft breach and OSINT indexes.",
        undefined,
        undefined,
        {
          tools: [
            { id: "minecraft-indexes", label: "Leak indexes", apiType: "minecraft" },
            {
              id: "seeknow-minecraft",
              label: "SeekNow Minecraft",
              apiType: "seeknow/gaming/minecraft",
            },
            {
              id: "seekria-minecraft",
              label: "Seekria Minecraft",
              apiType: "seekria/minecraft",
            },
            {
              id: "seekria-minecraft-osint",
              label: "Seekria Minecraft OSINT",
              apiType: "seekria/minecraft-osint",
            },
            {
              id: "seekria-name-history",
              label: "Seekria name history",
              apiType: "seekria/name-history",
            },
            {
              id: "seekria-laby-stats",
              label: "Seekria LabyMod",
              apiType: "seekria/laby-stats",
            },
            {
              id: "seekria-minecraft-texture",
              label: "Seekria skin / cape",
              apiType: "seekria/minecraft-texture",
            },
            {
              id: "oathnet-mc-history",
              label: "OathNet MC history",
              apiType: "oathnet/mc-history",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Steam",
        "steam",
        "breach",
        "Steam ID or profile link",
        "Find Steam IDs, aliases, and linked accounts.",
        undefined,
        undefined,
        {
          tools: [
            { id: "steam-indexes", label: "Leak indexes", apiType: "breach" },
            {
              id: "oathnet-steam",
              label: "OathNet Steam",
              apiType: "oathnet/steam",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Xbox",
        "xbox",
        "breachhub",
        "Gamertag or Xbox ID",
        "Xbox gamertag and profile intelligence.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "xbox-indexes",
              label: "Leak indexes",
              apiType: "breachhub",
            },
            {
              id: "seeknow-xbox",
              label: "SeekNow Xbox",
              apiType: "seeknow/gaming/xbox",
            },
            {
              id: "oathnet-xbox",
              label: "OathNet Xbox",
              apiType: "oathnet/xbox",
            },
          ],
        },
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
        undefined,
        undefined,
        {
          tools: [
            {
              id: "google-docs-indexes",
              label: "Docs indexes",
              apiType: "breachhub",
            },
            {
              id: "datavoid-google-docs",
              label: "DataVoid Google Docs",
              apiType: "datavoid/google-docs",
            },
          ],
        },
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
        "telegram/username",
        "Telegram @username, numeric ID, or phone",
        "Telegram username, ID, and phone lookups via specialty indexes.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "tg-username",
              label: "Username",
              apiType: "telegram/username",
            },
            {
              id: "tg-id",
              label: "User ID",
              apiType: "telegram/id",
            },
            {
              id: "tg-phone",
              label: "Phone",
              apiType: "telegram/phone",
            },
            {
              id: "tg-indexes",
              label: "Leak indexes",
              apiType: "breach",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Twitter",
        "twitter",
        "breach",
        "X / Twitter user or profile link",
        "X and legacy Twitter username search.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "twitter-indexes",
              label: "Leak indexes",
              apiType: "breach",
            },
            {
              id: "seeknow-twitter",
              label: "SeekNow Twitter",
              apiType: "seeknow/username/twitter",
            },
            {
              id: "datavoid-twitter",
              label: "DataVoid Twitter",
              apiType: "datavoid/twitter",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "X Name History",
        "memory",
        "memory",
        "X / Twitter @username or numeric ID",
        "Historical screen-name timeline for X and legacy Twitter accounts.",
      ),
      mod(
        "Platforms",
        "Instagram",
        "instagram",
        "instagram",
        "Instagram user or profile link",
        "Profile intel plus follower and following list export.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "instagram-live",
              label: "Instagram OSINT",
              apiType: "instagram",
            },
            {
              id: "instagram-id",
              label: "Instagram ID",
              apiType: "instagram/id",
            },
            {
              id: "datavoid-instagram",
              label: "DataVoid Instagram",
              apiType: "datavoid/instagram",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Snapchat",
        "snapchat",
        "snapchat",
        "Snapchat user or profile link",
        "Snapchat username and link pivots via specialty indexes.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "snapchat-live",
              label: "Snapchat lookup",
              apiType: "snapchat",
            },
            {
              id: "snapchat-indexes",
              label: "Leak indexes",
              apiType: "breach",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "Medal",
        "medal",
        "medal",
        "Medal.tv username or profile URL",
        "Medal.tv profile lookup via specialty indexes.",
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
        undefined,
        undefined,
        {
          tools: [
            { id: "tiktok-live", label: "Live recon", apiType: "tiktok-recon" },
            {
              id: "seeknow-tiktok",
              label: "SeekNow TikTok",
              apiType: "seeknow/username/tiktok",
            },
            {
              id: "seekria-tiktok-lookup",
              label: "Seekria lookup",
              apiType: "seekria/tiktok-lookup",
            },
            {
              id: "seekria-tiktok-breach",
              label: "Seekria breach",
              apiType: "seekria/tiktok-breach",
            },
          ],
        },
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
        undefined,
        undefined,
        {
          tools: [
            { id: "reddit-indexes", label: "Leak indexes", apiType: "reddit" },
            {
              id: "room101-user",
              label: "Room101 user",
              apiType: "room101/user",
            },
            {
              id: "room101-analyze",
              label: "Room101 analyze",
              apiType: "room101/analyze",
            },
            {
              id: "room101-search",
              label: "Room101 search",
              apiType: "room101/v2/search",
            },
            {
              id: "room101-subreddit",
              label: "Room101 subreddit",
              apiType: "room101/subreddit",
            },
            {
              id: "seeknow-reddit",
              label: "SeekNow Reddit",
              apiType: "seeknow/username/reddit",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "GitHub",
        "github",
        "breach",
        "GitHub user or profile link",
        "GitHub usernames, repos, and leaked emails.",
        undefined,
        undefined,
        {
          tools: [
            { id: "github-indexes", label: "Leak indexes", apiType: "breach" },
            {
              id: "seeknow-github",
              label: "SeekNow GitHub",
              apiType: "seeknow/username/github",
            },
            {
              id: "seeknow-social",
              label: "SeekNow social",
              apiType: "seeknow/username/social",
            },
            {
              id: "seeknow-history",
              label: "SeekNow history",
              apiType: "seeknow/username/history",
            },
          ],
        },
      ),
      mod(
        "Platforms",
        "FiveM",
        "fivem",
        "fivem",
        "Linked Discord ID",
        "FiveM server intel via linked Discord ID.",
        undefined,
        undefined,
        {
          tools: [
            {
              id: "fivem-indexes",
              label: "FiveM OSINT",
              apiType: "fivem",
            },
            {
              id: "reconly-fivem",
              label: "Reconly FiveM",
              apiType: "reconly",
            },
            {
              id: "seekria-fivem",
              label: "Seekria FiveM",
              apiType: "seekria/fivem",
            },
            {
              id: "datavoid-fivem",
              label: "DataVoid FiveM",
              apiType: "datavoid/fivem",
            },
          ],
        },
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
        "Live Tinder recommendations via operator session â€” apply age, distance, gender, and Passport location filters.",
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
        "Hinge Live",
        "hinge-live",
        "hinge-live",
        "40.7128,-74.0060 ageMin=22 ageMax=35 distanceMi=25 gender=1 q=alex",
        "Live Hinge recommendations via operator session â€” set location/prefs, hydrate profiles, optional local keyword filter.",
        undefined,
        undefined,
        {
          lawfulUseNotice: true,
          lawfulUseCopy:
            "Hinge Live uses a company-operated Hinge session. It returns a personalized recommendation feed sample, not a full area database. Authorized investigative use only. Do not scrape, harass, or store profiles beyond case need. Hinge ToS and local law still apply.",
        },
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

/** Former Public Records sidebar modules â€” kept for deep links / API billing maps. */
export const LEGACY_PUBLIC_RECORDS_MODULES: SearchModuleDef[] = [
  mod(
    "Public Records",
    "Global Public Records",
    "global-public-records",
    "us-global",
    "John Doe, VA â€” or John Doe, GB",
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
    "John Doe, VA â€” or John Doe, DE â€” or a federal docket number",
    "Federal RECAP dockets and live state/county court adapters.",
    undefined,
    undefined,
    { lawfulUseNotice: true, optionalFilters: PERSON_GEO_FILTERS },
  ),
  mod(
    "Public Records",
    "Identity Search",
    "identity-search",
    "us-identity",
    "John Doe, Fairfax County, VA â€” or Name, 22030",
    "Compose FEC, NPI, OFAC, UN sanctions, wanted, inmate, NSOPW, licenses, and court indexes.",
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
    "John Smith â€” or John Smith, VA â€” or ZIP 23220",
    "Live NSOPW national search across US states & territories, plus Canada RCMP high-risk child SOR.",
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
    "John Smith, Fairfax County, VA â€” or John Smith, 22030",
    "Live Virginia State Police registry plus NSOPW scoped to VA.",
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
    "John Doe â€” optional state code (e.g. TX)",
    "Official court and sex-offender registry portals for all 50 US states + DC.",
    undefined,
    undefined,
    { lawfulUseNotice: true },
  ),
  mod(
    "Public Records",
    "Portal Adapter Backlog",
    "portal-backlog",
    "us-portal-backlog",
    "John Doe, FL â€” or John Doe, TX",
    "150+ prioritized government portals queued for live adapters.",
    undefined,
    undefined,
    { lawfulUseNotice: true },
  ),
  mod(
    "Public Records",
    "International Records Directory",
    "international-records-directory",
    "us-intl-directory",
    "John Doe, GB â€” or country code",
    "Official court, business registry, and sanctions portal links for major countries.",
    undefined,
    undefined,
    { lawfulUseNotice: true },
  ),
];

export const ALL_SEARCH_MODULES: SearchModuleDef[] = [
  ...AI_SEARCH_MODULES,
  ...SEARCH_MODULE_SECTIONS.flatMap((s) => s.items),
  ...LEGACY_PUBLIC_RECORDS_MODULES,
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

  const normalized = slug.toLowerCase();
  const aliasTool = CRYPTO_INTEL_LEGACY_TOOL_BY_SLUG[normalized];
  const lookupSlug = aliasTool ? CRYPTO_INTEL_UNIFIED_SLUG : normalized;
  const moduleDef = MODULE_BY_SLUG.get(lookupSlug);

  if (moduleDef && isCryptoIntelSlug(moduleDef.slug) && !isCryptoIntelEnabled()) {
    return undefined;
  }

  if (moduleDef && isTinderLiveSlug(moduleDef.slug) && !isTinderLiveEnabled()) {
    return undefined;
  }

  if (moduleDef && isHingeLiveSlug(moduleDef.slug) && !isHingeLiveEnabled()) {
    return undefined;
  }

  return moduleDef;
}

export function getCryptoIntelToolIdForLegacySlug(
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;

  return CRYPTO_INTEL_LEGACY_TOOL_BY_SLUG[slug.toLowerCase()] ?? null;
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
  "crypto-intel": "crypto-full",
  "crypto-full": "crypto-full",
  "crypto-address": "crypto-address",
  "crypto-tx": "crypto-tx",
  "crypto-risk": "crypto-risk",
  "crypto-flow": "crypto-flow",
  "crypto-ai": "ai",
  "bin-lookup": "bin",
  "iban-check": "iban",
  "bank-search": "bank",
  "vin-decoder": "vin",
  "car-insurance-us": "car-insurance",
  "healthcare-us": "healthcare",
  "public-records": "public-records",
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
  "combo-lookup": "snusbase/combo-lookup",
  snusbase: "snusbase",
  "ip-whois": "snusbase/ip-whois",
  "seeknow-search": "seeknow/search",
  "seeknow-stealer": "seeknow/stealer",
  wentyn: "wentyn",
  memory: "memory",
  reconly: "reconly",
  ipinfo: "ipinfo",
  melissa: "melissa",
  leaksight: "leaksight",
  inf0sec: "inf0sec",
  checko: "checko",
  datavoid: "datavoid/recovery",
  "seekria-breaches": "seekria/email-breach",
  "seekria-discord": "seekria/discord",
  "seekria-roblox": "seekria/roblox",
  "seekria-minecraft": "seekria/minecraft",
  "seekria-fivem": "seekria/fivem",
  "seekria-ip": "seekria/ip",
  "seekria-domain": "seekria/domain-lookup",
  "seekria-footprint": "seekria/user-footprint",
  "password-search": "breach",
  "name-search": "breach",
  "email-analyze": "email-analyze",
  "fraud-footprint": "seon/email",
  "seon-email": "seon/email",
  "seon-phone": "seon/phone",
  "seon-email-verification": "seon/email-verification",
  "seon-ip": "seon/ip",
  "seon-bin": "seon/bin",
  breachbase: "breaches",
  "oathnet-roblox": "oathnet-roblox",
  "contact-enrich": "contact-enrich",
  propertyradar: "propertyradar/search",
  "propertyradar-search": "propertyradar/search",
  "propertyradar-persons": "propertyradar/persons",
  "propertyradar-phone": "propertyradar/phone",
  "propertyradar-email": "propertyradar/email",
  "propertyradar-skiptrace": "propertyradar/skiptrace",
  "shodan-host": "shodan-host",
  "site-pentest": "site-pentest",
  "tiktok-recon": "tiktok-recon",
  "share-resolver": "share-resolver",
  "account-finder": "username-accounts",
  "handle-sweep": "handle-sweep",
  "email-presence": "email-presence",
  "index-sweep": "index-sweep",
  "phone-index": "index-sweep",
  ip: "ip",
  intelx: "intelx",
  "stealer-logs": "stealer",
  phone: "breach",
  username: "breach",
  steam: "breach",
  xbox: "breach",
  "google-docs": "breachhub",
  ganknow: "breachhub",
  hwid: "breachhub",
  "facebook-id": "breachhub",
  passport: "breachhub",
  "notalivex-country": "notalivex/mx/email",
  "notalivex-platform": "notalivex/tg/username",
  "notalivex-renaper": "notalivex/ar_rena/renaper",
  telegram: "telegram/username",
  instagram: "instagram",
  snapchat: "snapchat",
  medal: "medal",
  tiktok: "breach",
  twitter: "breach",
  github: "github",
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

/** Absolute API path for a resolved search apiType segment. */
export function resolveSearchApiPath(apiType: string): string {
  if (
    apiType === "snusbase" ||
    apiType.startsWith("snusbase/") ||
    apiType === "intelvault" ||
    apiType.startsWith("intelvault/") ||
    apiType === "osintcat" ||
    apiType.startsWith("osintcat/") ||
    apiType === "seekria" ||
    apiType.startsWith("seekria/") ||
    apiType === "seeknow" ||
    apiType.startsWith("seeknow/") ||
    apiType === "room101" ||
    apiType.startsWith("room101/") ||
    apiType === "notalivex" ||
    apiType.startsWith("notalivex/") ||
    apiType === "seon" ||
    apiType.startsWith("seon/") ||
    apiType === "wentyn" ||
    apiType === "memory" ||
    apiType === "medal" ||
    apiType === "reconly" ||
    apiType === "melissa" ||
    apiType === "leaksight" ||
    apiType === "inf0sec" ||
    apiType === "checko" ||
    apiType === "vin" ||
    apiType === "ipinfo" ||
    apiType === "github" ||
    apiType === "datavoid" ||
    apiType.startsWith("datavoid/") ||
    apiType === "propertyradar" ||
    apiType.startsWith("propertyradar/") ||
    apiType === "telegram" ||
    apiType.startsWith("telegram/") ||
    apiType === "snapchat" ||
    apiType === "nbrs" ||
    apiType.startsWith("nbrs/") ||
    apiType === "nosint" ||
    apiType.startsWith("nosint/") ||
    apiType === "binlist" ||
    apiType === "hudsonrock" ||
    apiType.startsWith("hudsonrock/") ||
    apiType === "oathnet" ||
    apiType.startsWith("oathnet/") ||
    apiType === "shodan" ||
    apiType.startsWith("shodan/") ||
    // Specialty Instagram ID only — bare "instagram" stays on /api/osint/instagram.
    apiType === "instagram/id" ||
    // Specialty Discord routes only — bare "discord" stays on /api/osint/discord.
    apiType === "discord/user" ||
    apiType === "discord/history" ||
    apiType === "discord/export" ||
    apiType === "discord/snowflake"
  ) {
    return `/api/${apiType}`;
  }

  return `/api/osint/${apiType}`;
}

export function getHubSections(): SearchModuleSection[] {
  const cryptoEnabled = isCryptoIntelEnabled();
  const cryptoSection = SEARCH_MODULE_SECTIONS.find(
    (section) => section.title === CRYPTO_INTEL_SECTION_TITLE,
  );
  const cryptoIntel = cryptoSection?.items.find(
    (item) => item.slug === CRYPTO_INTEL_UNIFIED_SLUG,
  );
  const cryptoRoadmap =
    cryptoSection?.items.filter(
      (item) => item.slug !== CRYPTO_INTEL_UNIFIED_SLUG,
    ) ?? [];

  const withSection = (
    item: SearchModuleDef,
    section: string,
  ): SearchModuleDef =>
    item.section === section ? item : { ...item, section };

  const aiItems = AI_SEARCH_MODULES.map((item) =>
    withSection(item, CRYPTO_AI_FALLBACK_SECTION),
  );

  const sections: SearchModuleSection[] = [
    { title: "AI Intelligence", items: aiItems },
  ];

  for (const section of SEARCH_MODULE_SECTIONS) {
    if (section.title === CRYPTO_INTEL_SECTION_TITLE) {
      if (!cryptoEnabled) continue;

      const items: SearchModuleDef[] = [];

      if (cryptoIntel) {
        items.push(withSection(cryptoIntel, CRYPTO_INTEL_SECTION_TITLE));
      }
      // Roadmap stubs stay in the catalog for /coming-soon routes but stay out of
      // the live sidebar so Crypto Intel reads as one unified module.
      for (const item of cryptoRoadmap) {
        if (item.comingSoon) continue;
        items.push(withSection(item, CRYPTO_INTEL_SECTION_TITLE));
      }

      sections.push({ title: CRYPTO_INTEL_SECTION_TITLE, items });
      continue;
    }

    if (section.title === "Dating Apps") {
      const items = section.items.filter(
        (item) =>
          !INTENT_HUB_HIDDEN_SLUGS.has(item.slug) &&
          !(isTinderLiveSlug(item.slug) && !isTinderLiveEnabled()) &&
          !(isHingeLiveSlug(item.slug) && !isHingeLiveEnabled()),
      );

      sections.push({ title: section.title, items });
      continue;
    }

    if (section.title === CRYPTO_WALLET_FALLBACK_SECTION) {
      if (!cryptoEnabled && cryptoIntel) {
        sections.push({
          title: section.title,
          items: [
            withSection(cryptoIntel, CRYPTO_WALLET_FALLBACK_SECTION),
            ...section.items.filter(
              (item) => !INTENT_HUB_HIDDEN_SLUGS.has(item.slug),
            ),
          ],
        });
      } else {
        sections.push({
          title: section.title,
          items: section.items.filter(
            (item) => !INTENT_HUB_HIDDEN_SLUGS.has(item.slug),
          ),
        });
      }
      continue;
    }

    sections.push({
      title: section.title,
      items: section.items.filter(
        (item) => !INTENT_HUB_HIDDEN_SLUGS.has(item.slug),
      ),
    });
  }

  return sections;
}

/** @deprecated Use live health from /api/osint/modules/health via ModuleStatusDot. */
export const MODULE_OPERATIONAL: Record<string, boolean> = {
  "ai-search": true,
  "ai-deep-scan": true,
  "crypto-ai": true,
  "crypto-intel": true,
  "crypto-full": true,
  "threat-brief": true,
  intelx: true,
  "stealer-logs": true,
  breaches: true,
  phone: true,
  username: true,
  ip: true,
  domain: true,
  "hash-lookup": true,
  "combo-lookup": true,
  snusbase: true,
  "ip-whois": true,
  "seeknow-search": true,
  "seeknow-stealer": true,
  wentyn: true,
  memory: true,
  reconly: true,
  ipinfo: true,
  datavoid: true,
  melissa: true,
  leaksight: true,
  inf0sec: true,
  checko: true,
  "seekria-breaches": true,
  "seekria-discord": true,
  "seekria-roblox": true,
  "seekria-minecraft": true,
  "seekria-fivem": true,
  "seekria-ip": true,
  "seekria-domain": true,
  "seekria-footprint": true,
  "password-search": true,
  "name-search": true,
  "email-analyze": true,
  "email-presence": true,
  "index-sweep": true,
  "phone-index": true,
  "fraud-footprint": true,
  breachbase: true,
  "oathnet-roblox": true,
  "contact-enrich": true,
  propertyradar: true,
  "propertyradar-search": true,
  "propertyradar-persons": true,
  "propertyradar-phone": true,
  "propertyradar-email": true,
  "propertyradar-skiptrace": true,
  "account-finder": true,
  "handle-sweep": true,
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
  "public-records": true,
  "court-records": true,
  "identity-search": true,
  "npd-search": true,
  "va-sex-offender": true,
  "global-public-records": true,
  "sanctions-watchlists": true,
  "wanted-persons": true,
  "national-sor": true,
  "state-records-directory": true,
  "portal-backlog": true,
  "international-records-directory": true,
  "discord-id": true,
  roblox: true,
  minecraft: true,
  steam: true,
  xbox: true,
  hwid: true,
  "facebook-id": true,
  passport: true,
  "notalivex-country": true,
  "notalivex-platform": true,
  "notalivex-renaper": true,
  "google-docs": true,
  ganknow: true,
  playstation: false,
  telegram: true,
  instagram: true,
  snapchat: true,
  medal: true,
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
  "hinge-live": true,
  match: true,
  okcupid: true,
  pof: true,
  grindr: true,
  badoo: true,
};

export function isModuleOperational(slug: string): boolean {
  return MODULE_OPERATIONAL[slug] ?? false;
}
