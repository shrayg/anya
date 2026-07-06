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
): Promise<SanitizedBreachResponse> {
  const parts: SanitizedBreachResponse[] = [];
  const [osintcatResult, godseyeResult] = await Promise.allSettled([
    fetchOptionalOsintCatPlatformSearch(
      osintCatEndpoint,
      query,
    ),
    fetchGodsEyeSearchResult(
      godseyeType,
      query,
      COMBINED_GODSEYE_TIMEOUT_MS,
    ),
  ]);

  if (
    osintcatResult.status === "fulfilled" &&
    osintcatResult.value &&
    osintcatResult.value.count > 0
  ) {
    parts.push(osintcatResult.value);
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
): Promise<SanitizedBreachResponse> {
  if (!getGodsEyeApiKey()) {
    throw new Error(publicServiceUnavailable());
  }

  return fetchGodsEyeSearchResult(godseyeType, query, COMBINED_GODSEYE_TIMEOUT_MS);
}

export async function fetchCombinedOsintCatEndpoint(
  endpoint: string | undefined,
  query: string,
  godseyeType: GodsEyeSearchType,
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

  try {
    payload.godseye = await fetchGodsEyeSearchResult(
      godseyeType,
      query,
      COMBINED_GODSEYE_TIMEOUT_MS,
    );
    (payload.sources as string[]).push("index");
  } catch (err) {
    payload.godseyeError =
      err instanceof Error ? err.message : "Index lookup failed";
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
): Promise<SanitizedBreachResponse> {
  return fetchCombinedPlatformSearch(query, endpoint, godseyeType);
}

export async function fetchCombinedDomainOsint(
  domain: string,
): Promise<{ osintcat: OsintCatResponse | null; godseye: SanitizedBreachResponse | null }> {
  let osintcat: OsintCatResponse | null = null;
  let godseye: SanitizedBreachResponse | null = null;

  try {
    osintcat = await fetchOsintCatEndpoint("database-search", domain, {
      type: "domain",
    });
  } catch {
    osintcat = null;
  }

  try {
    godseye = await fetchGodsEyeSearchResult(
      "domain",
      domain,
      COMBINED_GODSEYE_TIMEOUT_MS,
    );
  } catch {
    godseye = null;
  }

  return { osintcat, godseye };
}
