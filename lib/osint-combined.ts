import {
  fetchBreachHubAdditiveBreachSearch,
  fetchBreachHubAdditiveStealerSearch,
  fetchBreachHubSpecialty,
  isBreachHubEnabled,
  mapGodsEyeTypeToBreachHub,
} from "@/lib/breachhub";
import { fetchBreachVipSanitized, type BreachVipField } from "@/lib/breachvip";
import {
  fetchCsintAdditiveBreachSearch,
  fetchCsintAdditiveStealerSearch,
  fetchCsintGithub,
  fetchCsintHashLookup,
  fetchCsintMinecraft,
  isCsintEnabled,
  mapGodsEyeTypeToCsint,
} from "@/lib/csint";
import { filterIntelResultsForQuery } from "@/lib/intel-record";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import {
  fetchGodsEyeSearchResult,
  getGodsEyeApiKey,
  resolveGodsEyeSearchType,
  type GodsEyeSearchType,
} from "@/lib/godseye";
import {
  fetchOsintCatEndpoint,
  fetchOsintCatStealerLogs,
  isOsintCatEndpointSupported,
  mergeSanitizedResponses,
  sanitizeBreachResponse,
  type OsintCatResponse,
  type SanitizedBreachResponse,
} from "@/lib/osintcat";
import { settleWithinBudget } from "@/lib/osint-search-guard";
import {
  hasOsintCatDirect,
  isBreachHubPrimaryActive,
  shouldUseDirectBreachVip,
  shouldUseDirectOsintCatInParallel,
  withPrimaryFallback,
} from "@/lib/provider-dedupe";
import {
  getProviderCached,
  providerCacheKey,
  setProviderCached,
} from "@/lib/provider-result-cache";

/**
 * Combined fan-out: BreachHub is primary for mirrored vendors; CSINT / direct
 * OsintCat / Breach.vip run only as sequential fallbacks when BH misses
 * (see lib/provider-dedupe.ts). GodsEye stays parallel (distinct gateway).
 */

const COMBINED_GODSEYE_TIMEOUT_MS = 18_000;
const COMBINED_BREACHVIP_TIMEOUT_MS = 18_000;
const COMBINED_CSINT_TIMEOUT_MS = 22_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 42_000;
/** Wall budget across parallel providers — prefer coverage over ultra-aggressive cutoffs. */
const COMBINED_STEALER_BUDGET_MS = 48_000;
const COMBINED_PLATFORM_BUDGET_MS = 40_000;
const COMBINED_RESULT_CACHE_TTL_MS = 40_000;

async function fetchOptionalCsintUniversal(
  query: string,
  godseyeType: GodsEyeSearchType | string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;

  if (godseyeType === "hash") {
    return fetchCsintHashLookup(query);
  }

  if (godseyeType === "minecraft") {
    return fetchCsintMinecraft(query, "username");
  }

  if (godseyeType === "github") {
    return fetchCsintGithub(query);
  }

  return fetchCsintAdditiveBreachSearch(
    query,
    mapGodsEyeTypeToCsint(godseyeType),
    COMBINED_CSINT_TIMEOUT_MS,
  );
}

async function fetchOptionalCsintStealer(
  query: string,
  godseyeType: GodsEyeSearchType | string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;

  return fetchCsintAdditiveStealerSearch(
    query,
    mapGodsEyeTypeToCsint(godseyeType),
    COMBINED_CSINT_TIMEOUT_MS,
  );
}

async function fetchOptionalOsintCatPlatformSearch(
  endpoint: string | undefined,
  query: string,
): Promise<SanitizedBreachResponse | null> {
  if (!shouldUseDirectOsintCatInParallel()) return null;
  if (!endpoint || !isOsintCatEndpointSupported(endpoint)) {
    return null;
  }

  const data = await fetchOsintCatEndpoint(endpoint, query);

  return sanitizeBreachResponse(data);
}

async function fetchOptionalBreachVip(
  query: string,
  field: BreachVipField | undefined,
): Promise<SanitizedBreachResponse | null> {
  if (!field) return null;
  // When BreachHub is primary it already catalogs Breach.vip — skip parallel direct.
  if (!shouldUseDirectBreachVip()) return null;

  const data = await fetchBreachVipSanitized(query, field, {
    timeoutMs: COMBINED_BREACHVIP_TIMEOUT_MS,
  });

  return data.count > 0 ? data : null;
}

/** BreachHub primary, then CSINT additive — never parallel for the same vendors. */
async function fetchBreachHubThenCsintBreach(
  query: string,
  godseyeType: GodsEyeSearchType | string,
  breachHubScope?: string | null,
): Promise<SanitizedBreachResponse | null> {
  // Platform specialty modules: spend the BH budget on specialty fan-out, not
  // additive breach indexes (those starve Seeknow/OathNet/etc. under the wall).
  const specialtyOnly = Boolean(
    breachHubScope &&
      [
        "roblox",
        "minecraft",
        "xbox",
        "telegram",
        "twitter",
        "snapchat",
        "tiktok",
        "steam",
        "discord-roblox",
      ].includes(breachHubScope),
  );

  const { value } = await withPrimaryFallback(
    () =>
      fetchOptionalBreachHubUniversal(query, godseyeType, breachHubScope, {
        specialtyOnly,
      }),
    () => fetchOptionalCsintUniversal(query, godseyeType),
    (row) => Boolean(row && row.count > 0),
  );

  return value;
}

async function fetchBreachHubThenCsintStealer(
  query: string,
  godseyeType: GodsEyeSearchType | string,
): Promise<SanitizedBreachResponse | null> {
  const { value } = await withPrimaryFallback(
    () => fetchOptionalBreachHubStealer(query, godseyeType),
    () => fetchOptionalCsintStealer(query, godseyeType),
    (row) => Boolean(row && row.count > 0),
  );

  return value;
}

/** Direct OsintCat for stealer — unique rows when BH's OsintCat mirror is down. */
async function fetchOptionalDirectOsintCatStealer(
  query: string,
): Promise<SanitizedBreachResponse | null> {
  if (!hasOsintCatDirect()) return null;

  try {
    const data = await fetchOsintCatStealerLogs(query);

    return data.count > 0 ? data : null;
  } catch {
    return null;
  }
}

const BREACHHUB_SPECIALTY_SCOPES = new Set([
  "steam",
  "roblox",
  "minecraft",
  "discord",
  "discord-roblox",
  "telegram",
  "snapchat",
  "tiktok",
  "twitter",
  "reddit",
  "github",
  "instagram",
  "fivem",
  "xbox",
  "phone",
  "email",
  "domain",
  "ip",
  "stealer",
  "victims",
  "breach",
  "hwid",
  "facebook",
  "passport",
]);

async function fetchOptionalBreachHubUniversal(
  query: string,
  godseyeType: GodsEyeSearchType | string,
  breachHubScope?: string | null,
  options?: { specialtyOnly?: boolean },
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled()) return null;

  const specialty =
    (breachHubScope && BREACHHUB_SPECIALTY_SCOPES.has(breachHubScope)
      ? breachHubScope
      : null) ||
    (BREACHHUB_SPECIALTY_SCOPES.has(String(godseyeType))
      ? String(godseyeType)
      : null);

  const tasks: Promise<SanitizedBreachResponse | null>[] = [];

  if (!options?.specialtyOnly) {
    tasks.push(
      fetchBreachHubAdditiveBreachSearch(
        query,
        mapGodsEyeTypeToBreachHub(godseyeType),
        COMBINED_BREACHHUB_TIMEOUT_MS,
      ),
    );
  }

  if (specialty) {
    tasks.push(
      fetchBreachHubSpecialty(specialty, query, COMBINED_BREACHHUB_TIMEOUT_MS),
    );
  }

  if (tasks.length === 0) return null;

  const settled = await Promise.allSettled(tasks);
  const parts: SanitizedBreachResponse[] = [];

  for (const result of settled) {
    if (
      result.status === "fulfilled" &&
      result.value &&
      result.value.count > 0
    ) {
      parts.push(result.value);
    }
  }

  if (parts.length === 0) return null;

  return mergeSanitizedResponses(...parts);
}

async function fetchOptionalBreachHubStealer(
  query: string,
  godseyeType: GodsEyeSearchType | string,
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled()) return null;

  return fetchBreachHubAdditiveStealerSearch(
    query,
    mapGodsEyeTypeToBreachHub(godseyeType),
    COMBINED_BREACHHUB_TIMEOUT_MS,
  );
}

function pushSettledSanitized(
  parts: SanitizedBreachResponse[],
  result: PromiseSettledResult<SanitizedBreachResponse | null>,
) {
  if (result.status === "fulfilled" && result.value && result.value.count > 0) {
    parts.push(result.value);
  }
}

/** Rate-limit / quota errors must not hard-fail when other sources were tried. */
function isSoftProviderFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const lower = error.message.toLowerCase();

  return (
    lower.includes("too many searches") ||
    lower.includes("daily search limit") ||
    lower.includes("rate limit") ||
    lower.includes("per-minute") ||
    lower.includes("quota exceeded") ||
    lower.includes("temporarily unavailable due to provider limits")
  );
}

export async function fetchCombinedStealerLogs(
  query: string,
  scope?: string | null,
): Promise<SanitizedBreachResponse> {
  const searchType = resolveGodsEyeSearchType(query, scope);
  const cacheKey = providerCacheKey("combined-stealer", [
    query,
    searchType,
    scope ?? "",
  ]);
  const cached = getProviderCached<SanitizedBreachResponse>(cacheKey);

  if (cached) return cached;

  const parts: SanitizedBreachResponse[] = [];

  // GodsEye (distinct) ∥ BreachHub→CSINT (vendor dedupe) ∥ direct OsintCat.
  // Direct OsintCat stays parallel so BH OsintCat outages do not drop coverage.
  const [godseyeResult, gatewayResult, osintCatResult] = await settleWithinBudget(
    [
      fetchGodsEyeSearchResult(searchType, query, COMBINED_GODSEYE_TIMEOUT_MS),
      fetchBreachHubThenCsintStealer(query, searchType),
      fetchOptionalDirectOsintCatStealer(query),
    ],
    COMBINED_STEALER_BUDGET_MS,
  );

  if (godseyeResult.status === "fulfilled" && godseyeResult.value.count > 0) {
    parts.push(godseyeResult.value);
  }

  pushSettledSanitized(parts, gatewayResult);
  pushSettledSanitized(parts, osintCatResult);

  if (parts.length > 0) {
    const merged = mergeSanitizedResponses(...parts);
    const filtered = filterIntelResultsForQuery(query, merged.results);
    const payload = {
      count: filtered.length,
      results: filtered,
    };

    if (payload.count > 0) {
      setProviderCached(cacheKey, payload, COMBINED_RESULT_CACHE_TTL_MS);
    }

    return payload;
  }

  const gatewayError =
    gatewayResult.status === "rejected" && gatewayResult.reason instanceof Error
      ? gatewayResult.reason
      : null;

  const godseyeError =
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error &&
    !isSoftProviderFailure(godseyeResult.reason)
      ? godseyeResult.reason
      : null;

  throw (
    godseyeError ??
    gatewayError ??
    new Error(publicSearchError("No results from intelligence indexes."))
  );
}

export async function fetchCombinedPlatformSearch(
  query: string,
  osintCatEndpoint: string | undefined,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
  breachHubScope?: string | null,
): Promise<SanitizedBreachResponse> {
  const cacheKey = providerCacheKey("combined-platform", [
    query,
    osintCatEndpoint ?? "",
    godseyeType,
    breachVipField ?? "",
    breachHubScope ?? "",
  ]);
  const cached = getProviderCached<SanitizedBreachResponse>(cacheKey);

  if (cached) return cached;

  // GodsEye + optional direct BreachVIP; BH→CSINT sequential for mirrored vendors.
  const parts: SanitizedBreachResponse[] = [];
  const [osintcatResult, godseyeResult, breachVipResult, gatewayResult] =
    await settleWithinBudget(
      [
        fetchOptionalOsintCatPlatformSearch(osintCatEndpoint, query),
        fetchGodsEyeSearchResult(godseyeType, query, COMBINED_GODSEYE_TIMEOUT_MS),
        fetchOptionalBreachVip(query, breachVipField),
        fetchBreachHubThenCsintBreach(query, godseyeType, breachHubScope),
      ],
      COMBINED_PLATFORM_BUDGET_MS,
    );

  pushSettledSanitized(parts, osintcatResult);
  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);
  pushSettledSanitized(parts, gatewayResult);

  // OsintCat direct fallback when BH primary returned nothing.
  if (
    parts.length === 0 &&
    isBreachHubPrimaryActive() &&
    hasOsintCatDirect() &&
    osintCatEndpoint &&
    isOsintCatEndpointSupported(osintCatEndpoint)
  ) {
    const fallback = await fetchOsintCatEndpoint(osintCatEndpoint, query).catch(
      () => null,
    );
    const sanitized = fallback ? sanitizeBreachResponse(fallback) : null;

    if (sanitized && sanitized.count > 0) parts.push(sanitized);
  }

  if (parts.length > 0) {
    const merged = mergeSanitizedResponses(...parts);

    if (merged.count > 0) {
      setProviderCached(cacheKey, merged, COMBINED_RESULT_CACHE_TTL_MS);
    }

    return merged;
  }

  if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error &&
    !isSoftProviderFailure(godseyeResult.reason)
  ) {
    throw godseyeResult.reason;
  }

  return { count: 0, results: [] };
}

export async function fetchGodsEyeOnlySearch(
  query: string,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
  breachHubScope?: string | null,
): Promise<SanitizedBreachResponse> {
  const hasGodsEye = Boolean(getGodsEyeApiKey());
  const hasCsint = isCsintEnabled();
  const hasBreachHub = isBreachHubEnabled();

  const parts: SanitizedBreachResponse[] = [];

  const [godseyeResult, breachVipResult, gatewayResult] =
    await settleWithinBudget(
      [
        hasGodsEye
          ? fetchGodsEyeSearchResult(
              godseyeType,
              query,
              COMBINED_GODSEYE_TIMEOUT_MS,
            )
          : Promise.resolve(null),
        fetchOptionalBreachVip(query, breachVipField),
        fetchBreachHubThenCsintBreach(query, godseyeType, breachHubScope),
      ],
      COMBINED_PLATFORM_BUDGET_MS,
    );

  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);
  pushSettledSanitized(parts, gatewayResult);

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
  }

  if (!hasGodsEye && !breachVipField && !hasCsint && !hasBreachHub) {
    throw new Error(publicServiceUnavailable());
  }

  if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error &&
    !isSoftProviderFailure(godseyeResult.reason)
  ) {
    throw godseyeResult.reason;
  }

  return { count: 0, results: [] };
}

export async function fetchCombinedOsintCatEndpoint(
  endpoint: string | undefined,
  query: string,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
  breachHubScope?: string | null,
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    query,
    sources: [] as string[],
  };

  let lookupError = "";

  if (endpoint && isOsintCatEndpointSupported(endpoint)) {
    try {
      const indexPayload = await fetchOsintCatEndpoint(endpoint, query);

      // Flatten provider blob into neutral top-level fields.
      if (indexPayload && typeof indexPayload === "object") {
        const blob = indexPayload as Record<string, unknown>;

        if (blob.ipleaks && typeof blob.ipleaks === "object") {
          payload.ipleaks = blob.ipleaks;
        }
        if (blob.ipinfo && typeof blob.ipinfo === "object") {
          payload.ipinfo = blob.ipinfo;
        }
        if (!payload.ipleaks && !payload.ipinfo) {
          Object.assign(payload, blob);
        }
      }
      (payload.sources as string[]).push("index");
    } catch (err) {
      lookupError = err instanceof Error ? err.message : "Index lookup failed";
    }
  }

  const [godseyeResult, breachVipResult, gatewayResult] =
    await settleWithinBudget(
      [
        fetchGodsEyeSearchResult(godseyeType, query, COMBINED_GODSEYE_TIMEOUT_MS),
        fetchOptionalBreachVip(query, breachVipField),
        fetchBreachHubThenCsintBreach(query, godseyeType, breachHubScope),
      ],
      COMBINED_PLATFORM_BUDGET_MS,
    );

  const mergedParts: SanitizedBreachResponse[] = [];

  if (godseyeResult.status === "fulfilled" && godseyeResult.value.count > 0) {
    mergedParts.push(godseyeResult.value);
  } else if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error
  ) {
    lookupError = lookupError || godseyeResult.reason.message;
  }

  if (
    breachVipResult.status === "fulfilled" &&
    breachVipResult.value &&
    breachVipResult.value.count > 0
  ) {
    mergedParts.push(breachVipResult.value);
  }

  if (
    gatewayResult.status === "fulfilled" &&
    gatewayResult.value &&
    gatewayResult.value.count > 0
  ) {
    mergedParts.push(gatewayResult.value);
  }

  if (mergedParts.length > 0) {
    payload.indexHits = mergeSanitizedResponses(...mergedParts);
    (payload.sources as string[]).push("index");
  }

  if ((payload.sources as string[]).length === 0) {
    throw new Error(sanitizePublicText(lookupError) || publicSearchError());
  }

  if (lookupError) {
    const cleaned = sanitizePublicText(lookupError);

    if (cleaned) payload.error = cleaned;
  }

  return payload;
}

export async function fetchCombinedBreachEndpoint(
  endpoint: string | undefined,
  query: string,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
  breachHubScope?: string | null,
): Promise<SanitizedBreachResponse> {
  return fetchCombinedPlatformSearch(
    query,
    endpoint,
    godseyeType,
    breachVipField,
    breachHubScope,
  );
}

export async function fetchCombinedDomainOsint(domain: string): Promise<{
  osintcat: OsintCatResponse | null;
  godseye: SanitizedBreachResponse | null;
}> {
  let osintcat: OsintCatResponse | null = null;
  let godseye: SanitizedBreachResponse | null = null;

  // GodsEye + BreachVIP (when BH off) parallel; BH→CSINT sequential for overlaps.
  // OsintCat direct only when BH is not the primary (else BH covers osintcat-*).
  const [osintcatResult, godseyeResult, breachVipResult, gatewayResult] =
    await settleWithinBudget(
      [
        shouldUseDirectOsintCatInParallel()
          ? fetchOsintCatEndpoint("database-search", domain, {
              type: "domain",
            })
          : Promise.resolve(null),
        fetchGodsEyeSearchResult("domain", domain, COMBINED_GODSEYE_TIMEOUT_MS),
        fetchOptionalBreachVip(domain, "domain"),
        fetchBreachHubThenCsintBreach(domain, "domain"),
      ],
      COMBINED_PLATFORM_BUDGET_MS,
    );

  if (osintcatResult.status === "fulfilled" && osintcatResult.value) {
    osintcat = osintcatResult.value;
  }

  // When BH is primary and direct OsintCat is configured, use it only if the
  // BH→CSINT gateway path returned nothing (sequential OsintCat fallback).
  if (
    !osintcat &&
    isBreachHubPrimaryActive() &&
    hasOsintCatDirect() &&
    !(
      gatewayResult.status === "fulfilled" &&
      gatewayResult.value &&
      gatewayResult.value.count > 0
    )
  ) {
    try {
      osintcat = await fetchOsintCatEndpoint("database-search", domain, {
        type: "domain",
      });
    } catch {
      osintcat = null;
    }
  }

  const mergedParts: SanitizedBreachResponse[] = [];

  if (godseyeResult.status === "fulfilled" && godseyeResult.value.count > 0) {
    mergedParts.push(godseyeResult.value);
  }

  if (
    breachVipResult.status === "fulfilled" &&
    breachVipResult.value &&
    breachVipResult.value.count > 0
  ) {
    mergedParts.push(breachVipResult.value);
  }

  if (
    gatewayResult.status === "fulfilled" &&
    gatewayResult.value &&
    gatewayResult.value.count > 0
  ) {
    mergedParts.push(gatewayResult.value);
  }

  if (mergedParts.length > 0) {
    godseye = mergeSanitizedResponses(...mergedParts);
  }

  return { osintcat, godseye };
}
