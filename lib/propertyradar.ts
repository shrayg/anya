/**
 * PropertyRadar property / people / skip-trace client.
 *
 * Upstream (in priority order):
 * 1. Direct PROPERTYRADAR_API_KEY / PROPERTY_RADAR_API_KEY
 *    (+ optional PROPERTYRADAR_BASE_URL) → api.propertyradar.com
 * 2. BreachHub GET /api/propertyradar/{endpoint} (BREACHHUB_API_KEY)
 *
 * Site routes stay GET:
 *   /api/propertyradar/search|persons|phone|email|skiptrace
 * Direct native API uses POST /v1/properties and POST /v1/persons/{key}/Phone|Email
 * when a direct key is set.
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import { fetchWithTimeout, readResponseText } from "@/lib/fetch-with-timeout";
import {
  filterIntelResultsForQuery,
  scrubIntelResults,
} from "@/lib/intel-record";
import type { SanitizedBreachResponse } from "@/lib/osintcat";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import {
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { recordProviderRequest } from "@/lib/provider-request-log";

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;
const DEFAULT_DIRECT_BASE = "https://api.propertyradar.com";
const DEFAULT_BREACHHUB_BASE = "https://breachhub.org";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_DIGITS_RE = /^\+?\d{7,15}$/;
const RADAR_ID_RE = /^P[A-Z0-9]+$/i;

export const PROPERTYRADAR_ENDPOINTS = [
  "search",
  "persons",
  "phone",
  "email",
  "skiptrace",
] as const;

export type PropertyRadarEndpoint = (typeof PROPERTYRADAR_ENDPOINTS)[number];

export type PropertyRadarSearchResult = SanitizedBreachResponse & {
  query: string;
  endpoint: PropertyRadarEndpoint;
  source: "direct" | "breachhub";
  raw?: Record<string, unknown>;
};

const ENDPOINT_SET = new Set<string>(PROPERTYRADAR_ENDPOINTS);

export function isPropertyRadarEndpoint(
  value: string,
): value is PropertyRadarEndpoint {
  return ENDPOINT_SET.has(value.trim().toLowerCase());
}

export function propertyRadarModuleSlugForEndpoint(
  endpoint: PropertyRadarEndpoint,
): string {
  switch (endpoint) {
    case "phone":
      return "propertyradar-phone";
    case "email":
      return "propertyradar-email";
    case "persons":
      return "propertyradar-persons";
    case "skiptrace":
      return "propertyradar-skiptrace";
    default:
      return "propertyradar";
  }
}

export function getPropertyRadarApiKey(): string | undefined {
  const key =
    process.env.PROPERTYRADAR_API_KEY?.trim() ||
    process.env.PROPERTY_RADAR_API_KEY?.trim();

  return key || undefined;
}

export function getPropertyRadarBaseUrl(): string {
  const base =
    process.env.PROPERTYRADAR_BASE_URL?.trim() ||
    process.env.PROPERTY_RADAR_BASE_URL?.trim();

  if (base) return base.replace(/\/$/, "");

  return hasDirectPropertyRadarKey()
    ? DEFAULT_DIRECT_BASE
    : DEFAULT_BREACHHUB_BASE;
}

export function hasDirectPropertyRadarKey(): boolean {
  return Boolean(getPropertyRadarApiKey());
}

export function isPropertyRadarEnabled(): boolean {
  if (
    process.env.PROPERTYRADAR_ENABLED === "false" ||
    process.env.PROPERTY_RADAR_ENABLED === "false"
  ) {
    return false;
  }

  return hasDirectPropertyRadarKey() || isBreachHubEnabled();
}

function isNativePropertyRadarBase(base: string): boolean {
  return /propertyradar\.com/i.test(base);
}

function sanitizePropertyRadarError(message: string): string {
  const cleaned = sanitizePublicText(message).trim();

  if (!cleaned) return publicSearchError();

  const lower = cleaned.toLowerCase();

  if (
    lower.includes("quota") ||
    lower.includes("credit") ||
    lower.includes("balance") ||
    (lower.includes("limit") &&
      (lower.includes("exceed") ||
        lower.includes("reached") ||
        lower.includes("daily")))
  ) {
    return "Provider quota exceeded for this source. Try again later.";
  }
  if (
    (lower.includes("rate") &&
      (lower.includes("limit") || lower.includes("429"))) ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return "Too many searches right now. Wait a minute and try again.";
  }
  if (
    lower.includes("unauthorized") ||
    lower.includes("invalid api") ||
    lower.includes("api key") ||
    lower.includes("auth failed") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return publicServiceUnavailable();
  }

  return cleaned;
}

function toSanitized(
  payload: unknown,
  query: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (query.trim()) {
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  }

  if (
    results.length === 0 &&
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload)
  ) {
    const record = payload as Record<string, unknown>;
    const nested =
      record.results ?? record.result ?? record.data ?? record.properties;

    if (Array.isArray(nested) && nested.length > 0) {
      results = scrubIntelResults(nested);
    } else {
      const hasUseful = Object.keys(record).some(
        (key) =>
          ![
            "success",
            "message",
            "error",
            "status",
            "ok",
            "resultCount",
          ].includes(key),
      );

      if (hasUseful) {
        results = scrubIntelResults([payload]);
      }
    }
  }

  return { count: results.length, results };
}

function parsePurchase(raw: string | null | undefined, fallback: 0 | 1): 0 | 1 {
  if (raw == null || raw === "") return fallback;
  const v = raw.trim().toLowerCase();

  if (v === "1" || v === "true" || v === "yes") return 1;
  if (v === "0" || v === "false" || v === "no") return 0;

  return fallback;
}

function parseLimit(raw: string | null | undefined, fallback: number): number {
  const n = Number.parseInt((raw || "").trim(), 10);

  if (!Number.isFinite(n) || n < 1) return fallback;

  return Math.min(n, 50);
}

type CriteriaItem = { name: string; value: unknown };

function buildCriteriaFromInput(
  input: Record<string, string>,
): CriteriaItem[] {
  if (input.criteria) {
    try {
      const parsed = JSON.parse(input.criteria) as unknown;

      if (Array.isArray(parsed)) {
        return parsed as CriteriaItem[];
      }
    } catch {
      // fall through to field-based criteria
    }
  }

  const criteria: CriteriaItem[] = [];
  const push = (name: string; value: unknown) => {
    criteria.push({ name, value });
  };

  const address =
    input.address ||
    input.siteAddress ||
    input.site_address ||
    input.street ||
    "";
  const ownerName =
    input.ownerName ||
    input.owner_name ||
    input.name ||
    input.owner ||
    "";
  const phone = input.phone || input.number || "";
  const email = input.email || "";
  const zip = input.zip || input.zipFive || input.zip_five || "";
  const city = input.city || "";
  const state = input.state || "";
  const query = input.query || "";

  if (address) push("SiteAddress", [address]);
  if (ownerName) push("OwnerName", [ownerName]);
  if (phone) {
    const digits = phone.replace(/\D/g, "");

    push("OwnerPhone", [digits || phone]);
  }
  if (email) push("OwnerEmail", [email]);
  if (zip) push("ZipFive", [Number.parseInt(zip, 10) || zip]);
  if (city) push("City", [city]);
  if (state) push("State", [state.toUpperCase()]);

  if (criteria.length === 0 && query) {
    if (EMAIL_RE.test(query)) {
      push("OwnerEmail", [query]);
    } else if (PHONE_DIGITS_RE.test(query.replace(/[\s().-]/g, ""))) {
      push("OwnerPhone", [query.replace(/\D/g, "")]);
    } else if (/\d/.test(query) && /\s/.test(query)) {
      push("SiteAddress", [query]);
    } else {
      push("OwnerName", [query]);
    }
  }

  return criteria;
}

function primaryQueryLabel(input: Record<string, string>): string {
  return (
    input.query ||
    input.address ||
    input.siteAddress ||
    input.name ||
    input.ownerName ||
    input.owner ||
    input.phone ||
    input.email ||
    input.personKey ||
    input.PersonKey ||
    input.radarId ||
    input.RadarID ||
    ""
  ).trim();
}

async function propertyRadarFetch(
  method: "GET" | "POST",
  path: string,
  opts: {
    query?: Record<string, string | number>;
    body?: unknown;
    timeoutMs: number;
  },
): Promise<Record<string, unknown>> {
  const apiKey = getPropertyRadarApiKey();

  if (!apiKey) {
    throw new Error(publicServiceUnavailable());
  }

  const base = getPropertyRadarBaseUrl();
  const url = new URL(
    path.startsWith("http")
      ? path
      : `${base}${path.startsWith("/") ? path : `/${path}`}`,
  );

  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const started = Date.now();
  let logged = false;

  const logRequest = (
    ok: boolean,
    logOpts?: { statusCode?: number; error?: string },
  ) => {
    if (logged) return;
    logged = true;
    recordProviderRequest({
      gateway: "propertyradar",
      path,
      method,
      ok,
      latencyMs: Date.now() - started,
      statusCode: logOpts?.statusCode,
      error: logOpts?.error,
    });
  };

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "AnyaInt-PropertyRadar/1.0",
      },
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      timeoutMs: opts.timeoutMs,
    });

    const remaining = Math.max(2_000, opts.timeoutMs - (Date.now() - started));
    const text = await readResponseText(res, remaining);
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      const errMsg = !res.ok
        ? sanitizePropertyRadarError(`HTTP ${res.status}`)
        : publicSearchError("Invalid response from intelligence index.");

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        (typeof data.title === "string" && data.title) ||
        `HTTP ${res.status}`;
      const errMsg = sanitizePropertyRadarError(msg);

      logRequest(false, { statusCode: res.status, error: errMsg });
      throw new Error(errMsg);
    }

    logRequest(true, { statusCode: res.status });

    return data;
  } catch (err) {
    logRequest(false, {
      error: err instanceof Error ? err.message : "Request failed",
    });
    throw err;
  }
}

async function fetchPropertyRadarBreachHub(
  endpoint: PropertyRadarEndpoint,
  input: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = { ...input };

  if (!params.query && primaryQueryLabel(input)) {
    params.query = primaryQueryLabel(input);
  }

  return breachHubGet(`/api/propertyradar/${endpoint}`, params, timeoutMs);
}

async function fetchSearchDirect(
  input: Record<string, string>,
  timeoutMs: number,
  opts?: { fields?: string; limit?: number; purchase?: 0 | 1 },
): Promise<Record<string, unknown>> {
  const criteria = buildCriteriaFromInput(input);

  if (criteria.length === 0) {
    throw new Error(
      "Missing search criteria. Provide query, address, name, phone, or email.",
    );
  }

  const purchase = opts?.purchase ?? parsePurchase(input.purchase, 1);
  const limit = opts?.limit ?? parseLimit(input.limit, 10);
  const fields =
    opts?.fields ||
    input.fields ||
    input.Fields ||
    "Card,Persons,overview";

  return propertyRadarFetch("POST", "/v1/properties", {
    query: { Purchase: purchase, Fields: fields, Limit: limit },
    body: { Criteria: criteria },
    timeoutMs,
  });
}

async function fetchPersonsDirect(
  input: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const radarId = (
    input.radarId ||
    input.RadarID ||
    input.radar_id ||
    ""
  ).trim();

  if (radarId) {
    const purchase = parsePurchase(input.purchase, 1);
    const fields = input.fields || input.Fields || "default";

    return propertyRadarFetch(
      "GET",
      `/v1/properties/${encodeURIComponent(radarId)}/persons`,
      {
        query: { Purchase: purchase, Fields: fields },
        timeoutMs,
      },
    );
  }

  return fetchSearchDirect(input, timeoutMs, {
    fields: input.fields || "Card,Persons,overview",
    limit: parseLimit(input.limit, 10),
    purchase: parsePurchase(input.purchase, 1),
  });
}

async function fetchContactUnlockDirect(
  kind: "Phone" | "Email",
  input: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const personKey = (
    input.personKey ||
    input.PersonKey ||
    input.person_key ||
    ""
  ).trim();

  if (personKey) {
    const purchase = parsePurchase(input.purchase, 1);

    return propertyRadarFetch(
      "POST",
      `/v1/persons/${encodeURIComponent(personKey)}/${kind}`,
      {
        query: { Purchase: purchase },
        timeoutMs,
      },
    );
  }

  const lookupInput = { ...input };

  if (kind === "Phone" && !lookupInput.phone && lookupInput.query) {
    lookupInput.phone = lookupInput.query;
  }
  if (kind === "Email" && !lookupInput.email && lookupInput.query) {
    lookupInput.email = lookupInput.query;
  }

  return fetchSearchDirect(lookupInput, timeoutMs, {
    fields: "Card,Persons,overview",
    limit: parseLimit(input.limit, 10),
    purchase: parsePurchase(input.purchase, 1),
  });
}

async function fetchSkiptraceDirect(
  input: Record<string, string>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const purchase = parsePurchase(input.purchase, 1);
  const search = await fetchSearchDirect(input, timeoutMs, {
    fields: input.fields || "Card,Persons,overview",
    limit: parseLimit(input.limit, 5),
    purchase,
  });

  const unlockContacts =
    input.unlock === "1" ||
    input.unlockContacts === "1" ||
    input.purchasePhone === "1" ||
    input.purchaseEmail === "1";

  if (!unlockContacts) {
    return { ...search, skiptrace: true };
  }

  const personKeys: string[] = [];
  const rows = extractBreachHubRows(search);

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const key =
      (typeof rec.PersonKey === "string" && rec.PersonKey) ||
      (typeof rec.personKey === "string" && rec.personKey) ||
      null;

    if (key) personKeys.push(key);

    const persons = rec.Persons;

    if (Array.isArray(persons)) {
      for (const person of persons) {
        if (!person || typeof person !== "object") continue;
        const pk = (person as Record<string, unknown>).PersonKey;

        if (typeof pk === "string" && pk) personKeys.push(pk);
      }
    }
  }

  const uniqueKeys = [...new Set(personKeys)].slice(0, 3);
  const contacts: Record<string, unknown>[] = [];

  for (const key of uniqueKeys) {
    if (input.purchasePhone !== "0") {
      try {
        contacts.push(
          await propertyRadarFetch(
            "POST",
            `/v1/persons/${encodeURIComponent(key)}/Phone`,
            { query: { Purchase: purchase }, timeoutMs },
          ),
        );
      } catch {
        // Skip individual unlock failures; property hits still returned.
      }
    }
    if (input.purchaseEmail !== "0") {
      try {
        contacts.push(
          await propertyRadarFetch(
            "POST",
            `/v1/persons/${encodeURIComponent(key)}/Email`,
            { query: { Purchase: purchase }, timeoutMs },
          ),
        );
      } catch {
        // Skip individual unlock failures.
      }
    }
  }

  return {
    ...search,
    skiptrace: true,
    contacts,
  };
}

/**
 * Raw PropertyRadar lookup — prefers direct key, else BreachHub proxy.
 */
export async function fetchPropertyRadar(
  endpoint: PropertyRadarEndpoint,
  input: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ data: Record<string, unknown>; source: "direct" | "breachhub" }> {
  if (!isPropertyRadarEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const label = primaryQueryLabel(input);
  const radarId = (input.radarId || input.RadarID || "").trim();
  const personKey = (input.personKey || input.PersonKey || "").trim();

  if (
    !label &&
    !radarId &&
    !personKey &&
    !input.criteria &&
    endpoint !== "persons"
  ) {
    throw new Error("Missing query");
  }

  if (
    hasDirectPropertyRadarKey() &&
    isNativePropertyRadarBase(getPropertyRadarBaseUrl())
  ) {
    let data: Record<string, unknown>;

    switch (endpoint) {
      case "search":
        data = await fetchSearchDirect(input, timeoutMs);
        break;
      case "persons":
        data = await fetchPersonsDirect(input, timeoutMs);
        break;
      case "phone":
        data = await fetchContactUnlockDirect("Phone", input, timeoutMs);
        break;
      case "email":
        data = await fetchContactUnlockDirect("Email", input, timeoutMs);
        break;
      case "skiptrace":
        data = await fetchSkiptraceDirect(input, timeoutMs);
        break;
      default:
        throw new Error("Unknown PropertyRadar endpoint.");
    }

    return { data, source: "direct" };
  }

  if (
    hasDirectPropertyRadarKey() &&
    !isNativePropertyRadarBase(getPropertyRadarBaseUrl())
  ) {
    const base = getPropertyRadarBaseUrl();
    const url = new URL(`${base}/api/propertyradar/${endpoint}`);
    const apiKey = getPropertyRadarApiKey()!;

    url.searchParams.set("key", apiKey);
    for (const [key, value] of Object.entries(input)) {
      if (value.trim()) url.searchParams.set(key, value.trim());
    }

    const started = Date.now();
    const res = await fetchWithTimeout(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "AnyaInt-PropertyRadar/1.0",
      },
      cache: "no-store",
      timeoutMs,
    });
    const text = await readResponseText(
      res,
      Math.max(2_000, timeoutMs - (Date.now() - started)),
    );
    let data: Record<string, unknown> = {};

    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(
        !res.ok
          ? sanitizePropertyRadarError(`HTTP ${res.status}`)
          : publicSearchError("Invalid response from intelligence index."),
      );
    }

    if (!res.ok) {
      const msg =
        (typeof data.message === "string" && data.message) ||
        (typeof data.error === "string" && data.error) ||
        `HTTP ${res.status}`;

      throw new Error(sanitizePropertyRadarError(msg));
    }

    recordProviderRequest({
      gateway: "propertyradar",
      path: `/api/propertyradar/${endpoint}`,
      method: "GET",
      ok: true,
      latencyMs: Date.now() - started,
      statusCode: res.status,
    });

    return { data, source: "direct" };
  }

  const data = await fetchPropertyRadarBreachHub(endpoint, input, timeoutMs);

  return { data, source: "breachhub" };
}

/** Sanitized PropertyRadar lookup for UI / specialty consumers. */
export async function fetchPropertyRadarSanitized(
  endpoint: PropertyRadarEndpoint,
  input: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PropertyRadarSearchResult> {
  const query = primaryQueryLabel(input);
  const { data, source } = await fetchPropertyRadar(endpoint, input, timeoutMs);
  const sanitized = toSanitized(data, query);

  return {
    ...sanitized,
    query,
    endpoint,
    source,
    raw: data,
  };
}

export function looksLikeRadarId(value: string): boolean {
  return RADAR_ID_RE.test(value.trim());
}
