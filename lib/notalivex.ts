/**
 * NotaliveX via BreachHub — country/platform breach DBs + AR Renaper.
 *
 * Upstream (BreachHub OpenAPI):
 *   GET /api/notalivex/{country}/{type}?query=
 *   GET /api/notalivex/{platform}/{type}?query=
 *   GET /api/notalivex/ar_rena/renaper?dni=&sexo=
 *
 * Auth: BREACHHUB_API_KEY. Disable with NOTALIVEX_ENABLED=false (or BREACHHUB_ENABLED=false).
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import type { SanitizedBreachResponse } from "@/lib/osintcat";
import {
  breachHubGet,
  extractBreachHubRows,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  filterIntelResultsForQuery,
  scrubIntelResults,
} from "@/lib/intel-record";
import { OSINT_PROVIDER_TIMEOUT_MS } from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

const DEFAULT_TIMEOUT_MS = OSINT_PROVIDER_TIMEOUT_MS;

/** Country codes from BreachHub NotAliveX docs. */
export const NOTALIVEX_COUNTRIES = [
  "mx",
  "ar",
  "cl",
  "br",
  "co",
  "co2",
  "pe",
  "ec",
  "ve",
  "uy",
  "bo",
  "pa",
  "rd",
  "sv",
  "ca",
  "us",
  "es",
  "ph",
] as const;

export type NotaliveXCountry = (typeof NOTALIVEX_COUNTRIES)[number];

/** Social / OSINT platform segments. */
export const NOTALIVEX_PLATFORMS = ["tg", "instagram", "osint"] as const;

export type NotaliveXPlatform = (typeof NOTALIVEX_PLATFORMS)[number];

/** Documented lookup types (union across countries + platforms). */
export const NOTALIVEX_TYPES = [
  "email",
  "nombre",
  "telefono",
  "dni",
  "cpf",
  "rut",
  "cedula",
  "curp",
  "rfc",
  "placa",
  "dui",
  "legal",
  "fone",
  "documento",
  "username",
  "id",
  "social",
] as const;

export type NotaliveXType = (typeof NOTALIVEX_TYPES)[number];

const COUNTRY_SET = new Set<string>(NOTALIVEX_COUNTRIES);
const PLATFORM_SET = new Set<string>(NOTALIVEX_PLATFORMS);
const TYPE_SET = new Set<string>(NOTALIVEX_TYPES);

export function isNotaliveXEnabled(): boolean {
  if (process.env.NOTALIVEX_ENABLED === "false") return false;

  return isBreachHubEnabled();
}

export function isNotaliveXCountry(segment: string): segment is NotaliveXCountry {
  return COUNTRY_SET.has(segment.toLowerCase());
}

export function isNotaliveXPlatform(
  segment: string,
): segment is NotaliveXPlatform {
  return PLATFORM_SET.has(segment.toLowerCase());
}

export function isNotaliveXType(type: string): type is NotaliveXType {
  return TYPE_SET.has(type.toLowerCase());
}

export function classifyNotaliveXSegment(
  segment: string,
): "country" | "platform" | null {
  const key = segment.trim().toLowerCase();

  if (key === "ar_rena") return null;
  if (isNotaliveXPlatform(key)) return "platform";
  if (isNotaliveXCountry(key)) return "country";

  return null;
}

function sanitizePayload(
  payload: Record<string, unknown>,
  query?: string,
): SanitizedBreachResponse {
  let results = scrubIntelResults(extractBreachHubRows(payload));

  if (query?.trim()) {
    results = scrubIntelResults(filterIntelResultsForQuery(query, results));
  }

  return { count: results.length, results };
}

/**
 * Country or platform lookup: GET /api/notalivex/{segment}/{type}?query=
 */
export async function fetchNotaliveXLookup(
  segment: string,
  type: string,
  query: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse> {
  if (!isNotaliveXEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const seg = segment.trim().toLowerCase();
  const typ = type.trim().toLowerCase();
  const q = query.trim();

  if (!seg || !typ) {
    throw new Error("Missing country/platform or type");
  }

  if (seg === "ar_rena") {
    throw new Error("Use /api/notalivex/ar_rena/renaper with dni and sexo");
  }

  if (!classifyNotaliveXSegment(seg)) {
    throw new Error("Unsupported NotaliveX country or platform");
  }

  if (!isNotaliveXType(typ)) {
    throw new Error("Unsupported NotaliveX lookup type");
  }

  if (!q) {
    throw new Error("Missing query");
  }

  const data = await breachHubGet(
    `/api/notalivex/${encodeURIComponent(seg)}/${encodeURIComponent(typ)}`,
    { query: q },
    timeoutMs,
  );

  return sanitizePayload(data, q);
}

export type RenaperParams = {
  dni: string;
  sexo: "M" | "F";
};

/** Parse "12345678 M", "12345678,M", "12345678/F", etc. */
export function parseRenaperQuery(raw: string): RenaperParams | null {
  const trimmed = raw.trim();

  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{6,10})\s*[,/;\s|-]+\s*([MFmf])$/);

  if (!match) return null;

  const sexo = match[2].toUpperCase() as "M" | "F";

  return { dni: match[1], sexo };
}

/**
 * Argentina RENAPER: GET /api/notalivex/ar_rena/renaper?dni=&sexo=
 */
export async function fetchNotaliveXRenaper(
  dni: string,
  sexo: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SanitizedBreachResponse & { dni: string; sexo: string }> {
  if (!isNotaliveXEnabled()) {
    throw new Error(publicServiceUnavailable());
  }

  const cleanDni = dni.trim().replace(/\D/g, "");
  const sex = sexo.trim().toUpperCase();

  if (!cleanDni || !/^\d{6,10}$/.test(cleanDni)) {
    throw new Error("Invalid DNI — use 6–10 digits");
  }

  if (sex !== "M" && sex !== "F") {
    throw new Error("sexo must be M or F");
  }

  const data = await breachHubGet(
    "/api/notalivex/ar_rena/renaper",
    { dni: cleanDni, sexo: sex },
    timeoutMs,
  );

  const sanitized = sanitizePayload(data, cleanDni);

  return { ...sanitized, dni: cleanDni, sexo: sex };
}
