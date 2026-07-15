import {
  fetchBreachVipSanitized,
  type BreachVipField,
} from "@/lib/breachvip";
import {
  publicSearchError,
  publicServiceUnavailable,
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

function pushSettledSanitized(
  parts: SanitizedBreachResponse[],
  result: PromiseSettledResult<SanitizedBreachResponse | null>,
) {
  if (
    result.status === "fulfilled" &&
    result.value &&
    result.value.count > 0
  ) {
    parts.push(result.value);
  }
}

export async function fetchCombinedStealerLogs(
  query: string,
  scope?: string | null,
): Promise<SanitizedBreachResponse> {
  const searchType = resolveGodsEyeSearchType(query, scope);
  const parts: SanitizedBreachResponse[] = [];

  const [stealerResult, godseyeResult] = await Promise.allSettled([
    fetchOsintCatStealerLogs(query),
    fetchGodsEyeSearchResult(
      searchType,
      query,
      COMBINED_GODSEYE_TIMEOUT_MS,
    ),
  ]);

  if (stealerResult.status === "fulfilled") {
    parts.push(stealerResult.value);
  }

  if (
    godseyeResult.status === "fulfilled" &&
    godseyeResult.value.count > 0
  ) {
    parts.push(godseyeResult.value);
  }

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
  }

  const stealerError =
    stealerResult.status === "rejected" &&
    stealerResult.reason instanceof Error
      ? stealerResult.reason
      : null;

  const godseyeError =
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error
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
): Promise<SanitizedBreachResponse> {
  const parts: SanitizedBreachResponse[] = [];
  const [osintcatResult, godseyeResult, breachVipResult] =
    await Promise.allSettled([
      fetchOptionalOsintCatPlatformSearch(osintCatEndpoint, query),
      fetchGodsEyeSearchResult(
        godseyeType,
        query,
        COMBINED_GODSEYE_TIMEOUT_MS,
      ),
      fetchOptionalBreachVip(query, breachVipField),
    ]);

  pushSettledSanitized(parts, osintcatResult);
  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
  }

  if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error
  ) {
    throw godseyeResult.reason;
  }

  return { count: 0, results: [] };
}

export async function fetchGodsEyeOnlySearch(
  query: string,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
): Promise<SanitizedBreachResponse> {
  const hasGodsEye = Boolean(getGodsEyeApiKey());
  const parts: SanitizedBreachResponse[] = [];

  const [godseyeResult, breachVipResult] = await Promise.allSettled([
    hasGodsEye
      ? fetchGodsEyeSearchResult(
          godseyeType,
          query,
          COMBINED_GODSEYE_TIMEOUT_MS,
        )
      : Promise.resolve(null),
    fetchOptionalBreachVip(query, breachVipField),
  ]);

  pushSettledSanitized(parts, godseyeResult);
  pushSettledSanitized(parts, breachVipResult);

  if (parts.length > 0) {
    return mergeSanitizedResponses(...parts);
  }

  if (!hasGodsEye && !breachVipField) {
    throw new Error(publicServiceUnavailable());
  }

  if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error
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
): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    query,
    sources: [] as string[],
  };

  if (endpoint && isOsintCatEndpointSupported(endpoint)) {
    try {
      payload.osintcat = await fetchOsintCatEndpoint(endpoint, query);
      (payload.sources as string[]).push("index");
    } catch (err) {
      payload.osintcatError =
        err instanceof Error ? err.message : "Index lookup failed";
    }
  }

  const [godseyeResult, breachVipResult] = await Promise.allSettled([
    fetchGodsEyeSearchResult(
      godseyeType,
      query,
      COMBINED_GODSEYE_TIMEOUT_MS,
    ),
    fetchOptionalBreachVip(query, breachVipField),
  ]);

  const mergedParts: SanitizedBreachResponse[] = [];

  if (
    godseyeResult.status === "fulfilled" &&
    godseyeResult.value.count > 0
  ) {
    mergedParts.push(godseyeResult.value);
  } else if (
    godseyeResult.status === "rejected" &&
    godseyeResult.reason instanceof Error
  ) {
    payload.godseyeError = godseyeResult.reason.message;
  }

  if (
    breachVipResult.status === "fulfilled" &&
    breachVipResult.value &&
    breachVipResult.value.count > 0
  ) {
    mergedParts.push(breachVipResult.value);
  }

  if (mergedParts.length > 0) {
    payload.godseye = mergeSanitizedResponses(...mergedParts);
    (payload.sources as string[]).push("index");
  }

  if ((payload.sources as string[]).length === 0) {
    throw new Error(
      String(payload.osintcatError || payload.godseyeError || publicSearchError()),
    );
  }

  return payload;
}

export async function fetchCombinedBreachEndpoint(
  endpoint: string | undefined,
  query: string,
  godseyeType: GodsEyeSearchType,
  breachVipField?: BreachVipField,
): Promise<SanitizedBreachResponse> {
  return fetchCombinedPlatformSearch(
    query,
    endpoint,
    godseyeType,
    breachVipField,
  );
}

export async function fetchCombinedDomainOsint(
  domain: string,
): Promise<{
  osintcat: OsintCatResponse | null;
  godseye: SanitizedBreachResponse | null;
}> {
  let osintcat: OsintCatResponse | null = null;
  let godseye: SanitizedBreachResponse | null = null;

  const [osintcatResult, godseyeResult, breachVipResult] =
    await Promise.allSettled([
      fetchOsintCatEndpoint("database-search", domain, {
        type: "domain",
      }),
      fetchGodsEyeSearchResult(
        "domain",
        domain,
        COMBINED_GODSEYE_TIMEOUT_MS,
      ),
      fetchOptionalBreachVip(domain, "domain"),
    ]);

  if (osintcatResult.status === "fulfilled") {
    osintcat = osintcatResult.value;
  }

  const mergedParts: SanitizedBreachResponse[] = [];

  if (
    godseyeResult.status === "fulfilled" &&
    godseyeResult.value.count > 0
  ) {
    mergedParts.push(godseyeResult.value);
  }

  if (
    breachVipResult.status === "fulfilled" &&
    breachVipResult.value &&
    breachVipResult.value.count > 0
  ) {
    mergedParts.push(breachVipResult.value);
  }

  if (mergedParts.length > 0) {
    godseye = mergeSanitizedResponses(...mergedParts);
  }

  return { osintcat, godseye };
}
