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

const COMBINED_GODSEYE_TIMEOUT_MS = 12_000;
const COMBINED_BREACHVIP_TIMEOUT_MS = 12_000;
const COMBINED_CSINT_TIMEOUT_MS = 15_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 18_000;

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

  const data = await fetchBreachVipSanitized(query, field, {
    timeoutMs: COMBINED_BREACHVIP_TIMEOUT_MS,
  });

  return data.count > 0 ? data : null;
}

async function fetchOptionalBreachHubUniversal(
  query: string,
  godseyeType: GodsEyeSearchType | string,
  breachHubScope?: string | null,
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled()) return null;

  const specialtyScopes = new Set([
    "steam",
    "roblox",
    "minecraft",
    "discord",
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
  ]);

  const tasks: Promise<SanitizedBreachResponse | null>[] = [
    fetchBreachHubAdditiveBreachSearch(
      query,
      mapGodsEyeTypeToBreachHub(godseyeType),
      COMBINED_BREACHHUB_TIMEOUT_MS,
    ),
  ];

  const specialty =
    (breachHubScope && specialtyScopes.has(breachHubScope)
      ? breachHubScope
      : null) ||
    (specialtyScopes.has(godseyeType) ? godseyeType : null);

  if (specialty) {
    tasks.push(
      fetchBreachHubSpecialty(specialty, query, COMBINED_BREACHHUB_TIMEOUT_MS),
    );
  }

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
  const parts: SanitizedBreachResponse[] = [];

  const [stealerResult, godseyeResult, csintResult, breachHubResult] =
    await Promise.allSettled([
      fetchOsintCatStealerLogs(query),
      fetchGodsEyeSearchResult(searchType, query, COMBINED_GODSEYE_TIMEOUT_MS),
      fetchOptionalCsintStealer(query, searchType),
      fetchOptionalBreachHubStealer(query, searchType),
    ]);

  if (stealerResult.status === "fulfilled") {
    parts.push(stealerResult.value);
  }

  if (godseyeResult.status === "fulfilled" && godseyeResult.value.count > 0) {
    parts.push(godseyeResult.value);
  }

  pushSettledSanitized(parts, csintResult);
  pushSettledSanitized(parts, breachHubResult);

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
  }

  const stealerError =
    stealerResult.status === "rejected" && stealerResult.reason instanceof Error
      ? stealerResult.reason
      : null;

  const godseyeError =
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error &&
    !isSoftProviderFailure(godseyeResult.reason)
      ? godseyeResult.reason
      : null;

  throw (
    godseyeError ??
    stealerError ??
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
  const parts: SanitizedBreachResponse[] = [];
  const [
    osintcatResult,
    godseyeResult,
    breachVipResult,
    csintResult,
    breachHubResult,
  ] = await Promise.allSettled([
    fetchOptionalOsintCatPlatformSearch(osintCatEndpoint, query),
    fetchGodsEyeSearchResult(godseyeType, query, COMBINED_GODSEYE_TIMEOUT_MS),
    fetchOptionalBreachVip(query, breachVipField),
    fetchOptionalCsintUniversal(query, godseyeType),
    fetchOptionalBreachHubUniversal(query, godseyeType, breachHubScope),
  ]);

  pushSettledSanitized(parts, osintcatResult);
  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);
  pushSettledSanitized(parts, csintResult);
  pushSettledSanitized(parts, breachHubResult);

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
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

  const [godseyeResult, breachVipResult, csintResult, breachHubResult] =
    await Promise.allSettled([
      hasGodsEye
        ? fetchGodsEyeSearchResult(
            godseyeType,
            query,
            COMBINED_GODSEYE_TIMEOUT_MS,
          )
        : Promise.resolve(null),
      fetchOptionalBreachVip(query, breachVipField),
      fetchOptionalCsintUniversal(query, godseyeType),
      fetchOptionalBreachHubUniversal(query, godseyeType, breachHubScope),
    ]);

  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);
  pushSettledSanitized(parts, csintResult);
  pushSettledSanitized(parts, breachHubResult);

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

  const [godseyeResult, breachVipResult, csintResult, breachHubResult] =
    await Promise.allSettled([
      fetchGodsEyeSearchResult(godseyeType, query, COMBINED_GODSEYE_TIMEOUT_MS),
      fetchOptionalBreachVip(query, breachVipField),
      fetchOptionalCsintUniversal(query, godseyeType),
      fetchOptionalBreachHubUniversal(query, godseyeType, breachHubScope),
    ]);

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
    csintResult.status === "fulfilled" &&
    csintResult.value &&
    csintResult.value.count > 0
  ) {
    mergedParts.push(csintResult.value);
  }

  if (
    breachHubResult.status === "fulfilled" &&
    breachHubResult.value &&
    breachHubResult.value.count > 0
  ) {
    mergedParts.push(breachHubResult.value);
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

  const [
    osintcatResult,
    godseyeResult,
    breachVipResult,
    csintResult,
    breachHubResult,
  ] = await Promise.allSettled([
    fetchOsintCatEndpoint("database-search", domain, {
      type: "domain",
    }),
    fetchGodsEyeSearchResult("domain", domain, COMBINED_GODSEYE_TIMEOUT_MS),
    fetchOptionalBreachVip(domain, "domain"),
    fetchCsintAdditiveBreachSearch(
      domain,
      "username",
      COMBINED_CSINT_TIMEOUT_MS,
    ),
    fetchOptionalBreachHubUniversal(domain, "domain"),
  ]);

  if (osintcatResult.status === "fulfilled") {
    osintcat = osintcatResult.value;
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
    csintResult.status === "fulfilled" &&
    csintResult.value &&
    csintResult.value.count > 0
  ) {
    mergedParts.push(csintResult.value);
  }

  if (
    breachHubResult.status === "fulfilled" &&
    breachHubResult.value &&
    breachHubResult.value.count > 0
  ) {
    mergedParts.push(breachHubResult.value);
  }

  if (mergedParts.length > 0) {
    godseye = mergeSanitizedResponses(...mergedParts);
  }

  return { osintcat, godseye };
}
