import { publicSearchError, publicServiceUnavailable } from "@/lib/public-branding";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { normalizeDomain } from "@/lib/domain-search";
import { scrubIntelResults } from "@/lib/intel-record";

const OSINTCAT_BASE = "https://www.osintcat.net/api";

/** Endpoints confirmed on OsintCat — platform-specific paths like /snapchat do not exist. */
export const OSINTCAT_SUPPORTED_ENDPOINTS = new Set([
  "breach",
  "discord",
  "database-search",
  "ip",
  "domain",
]);

export function isOsintCatEndpointSupported(endpoint: string): boolean {
  return OSINTCAT_SUPPORTED_ENDPOINTS.has(endpoint.trim().toLowerCase());
}

function sanitizeOsintCatError(message: string): string {
  const trimmed = message.trim();

  if (!trimmed) return publicSearchError();

  if (
    /path or asset.*(?:does not exist|was moved)/i.test(trimmed) ||
    /\/api\/[a-z0-9-]+/i.test(trimmed)
  ) {
    return publicSearchError("No results from intelligence indexes.");
  }

  return trimmed;
}

export type OsintCatResponse = Record<string, unknown>;

export type SanitizedBreachResponse = {
  count: number;
  results: unknown[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DISCORD_ID_RE = /^\d{17,20}$/;

export function isDiscordSnowflake(query: string): boolean {
  return DISCORD_ID_RE.test(query.trim());
}

export function getOsintCatApiKey(): string | undefined {
  return process.env.OSINTCAT_API_KEY;
}

export function detectStealerQueryType(
  query: string,
): "email" | "domain" | "discord" | "ip" | "generic" {
  const trimmed = query.trim();

  if (EMAIL_RE.test(trimmed)) return "email";
  if (IP_RE.test(trimmed)) return "ip";
  if (isDiscordSnowflake(trimmed)) return "discord";
  if (normalizeDomain(trimmed)) return "domain";

  return "generic";
}

export function extractOsintCatResults(data: OsintCatResponse | null): unknown[] {
  if (!data) return [];

  if (Array.isArray(data.breach_data)) return data.breach_data;
  if (Array.isArray(data.results)) return data.results;

  const nested = data.results;

  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = (nested as Record<string, unknown>).results;

    if (Array.isArray(inner)) return inner;
  }

  if (Array.isArray(data.data)) return data.data;

  return [];
}

export function filterDiscordResultsForId(
  query: string,
  data: OsintCatResponse,
): SanitizedBreachResponse {
  const sanitized = sanitizeBreachResponse(data);
  const normalizedQuery = query.trim();
  const exact = sanitized.results.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;

    const userId = (entry as Record<string, unknown>).user_id;

    return String(userId ?? "") === normalizedQuery;
  });

  return { count: exact.length, results: exact };
}

export function sanitizeBreachResponse(
  data: OsintCatResponse,
): SanitizedBreachResponse {
  const results = scrubIntelResults(extractOsintCatResults(data));
  return { count: results.length, results };
}

export function mergeSanitizedResponses(
  ...responses: SanitizedBreachResponse[]
): SanitizedBreachResponse {
  const seen = new Set<string>();
  const results: unknown[] = [];

  for (const response of responses) {
    for (const entry of response.results) {
      const key = JSON.stringify(entry);

      if (seen.has(key)) continue;

      seen.add(key);
      results.push(entry);
    }
  }

  const scrubbed = scrubIntelResults(results);

  return { count: scrubbed.length, results: scrubbed };
}

export async function fetchOsintCat(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<OsintCatResponse> {
  const apiKey = getOsintCatApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const url = new URL(`${OSINTCAT_BASE}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetchWithTimeout(url.toString(), {
    headers: { "X-API-KEY": apiKey },
    cache: "no-store",
    timeoutMs: 25_000,
  });

  const data = (await res.json()) as OsintCatResponse & {
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      sanitizeOsintCatError(
        String(data.message || data.error || publicSearchError()),
      ),
    );
  }

  if (typeof data.error === "string" && data.error.length > 0) {
    const status = typeof data.status === "string" ? data.status : "";

    if (status === "failed" || data.results === undefined) {
      throw new Error(sanitizeOsintCatError(data.error));
    }
  }

  return data;
}

export async function fetchOsintCatBreach(
  query: string,
): Promise<OsintCatResponse> {
  return fetchOsintCat("breach", { query });
}

export async function fetchOsintCatStealerLogs(
  query: string,
): Promise<SanitizedBreachResponse> {
  const trimmed = query.trim();
  const type = detectStealerQueryType(trimmed);

  switch (type) {
    case "email": {
      const [stealer, breach] = await Promise.allSettled([
        fetchOsintCat("database-search", { query: trimmed, type: "email" }),
        fetchOsintCatBreach(trimmed),
      ]);

      const parts: SanitizedBreachResponse[] = [];

      if (stealer.status === "fulfilled") {
        parts.push(sanitizeBreachResponse(stealer.value));
      }

      if (breach.status === "fulfilled") {
        parts.push(sanitizeBreachResponse(breach.value));
      }

      if (parts.length === 0) {
        const reason =
          stealer.status === "rejected"
            ? stealer.reason
            : breach.status === "rejected"
              ? breach.reason
              : new Error("Stealer log lookup failed");

        throw reason instanceof Error ? reason : new Error("Stealer log lookup failed");
      }

      return mergeSanitizedResponses(...parts);
    }
    case "domain": {
      const domain = normalizeDomain(trimmed);

      if (!domain) {
        throw new Error("Enter a valid domain name.");
      }

      const data = await fetchOsintCat("database-search", {
        query: domain,
        type: "domain",
      });

      return sanitizeBreachResponse(data);
    }
    case "discord": {
      throw new Error(
        "Discord IDs are not supported in Stealer Logs. Use the Discord ID module.",
      );
    }
    case "ip": {
      const data = await fetchOsintCat("ip", { query: trimmed });

      return { count: 1, results: [data] };
    }
    default: {
      const data = await fetchOsintCatBreach(trimmed);

      return sanitizeBreachResponse(data);
    }
  }
}

export async function fetchOsintCatDomainStealerLogs(
  domain: string,
): Promise<OsintCatResponse> {
  return fetchOsintCat("database-search", { query: domain, type: "domain" });
}

export async function fetchOsintCatEndpoint(
  endpoint: string,
  query: string,
  extraParams: Record<string, string> = {},
): Promise<OsintCatResponse> {
  if (!isOsintCatEndpointSupported(endpoint)) {
    throw new Error(publicSearchError("No results from intelligence indexes."));
  }

  return fetchOsintCat(endpoint, { query, ...extraParams });
}
