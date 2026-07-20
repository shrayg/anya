import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { paceSource, SOURCE_LIMITS } from "@/lib/us-records/robots-and-limits";

const BASE = "https://www.vspsor.com";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type VaSorOffender = {
  id?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  age?: number | string;
  imageUrl?: string;
  addressType?: string;
  location?: string;
  city?: string;
  postalCode?: string;
  county?: string;
};

type VaSorResponse = {
  offenders?: VaSorOffender[];
  recordsTotal?: number;
  totalItems?: number;
  Message?: string;
};

function extractToken(html: string): string | null {
  const classic =
    html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i) ||
    html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);

  if (classic?.[1]) return classic[1];

  // VSP randomizes the antiforgery input name; value still looks like ASP.NET CfDJ…
  const inputs = [...html.matchAll(/<input\b[^>]*>/gi)].map(
    (match) => match[0],
  );

  for (const input of inputs) {
    if (!/type=["']?hidden/i.test(input)) continue;
    const value = input.match(/value=["']([^"']+)["']/i)?.[1];

    if (value && /^CfDJ/i.test(value) && value.length >= 40) {
      return value;
    }
  }

  return null;
}

function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };

  if (typeof withGetter.getSetCookie === "function") {
    return withGetter.getSetCookie();
  }
  const single = headers.get("set-cookie");

  return single ? [single] : [];
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();

  for (const part of existing
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const idx = part.indexOf("=");

    if (idx > 0) map.set(part.slice(0, idx), part.slice(idx + 1));
  }

  for (const raw of setCookies) {
    const first = raw.split(";")[0] ?? "";
    const idx = first.indexOf("=");

    if (idx <= 0) continue;
    const name = first.slice(0, idx);
    const value = first.slice(idx + 1);

    if (
      raw.toLowerCase().includes("expires=thu, 01 jan 1970") ||
      value === ""
    ) {
      map.delete(name);
    } else {
      map.set(name, value);
    }
  }

  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function normalizeCounty(value?: string): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/\s+/g, " ").toUpperCase();

  if (!cleaned) return undefined;
  if (cleaned.endsWith(" COUNTY") || cleaned.endsWith(" CITY")) return cleaned;
  if (cleaned.includes("CITY") || cleaned.includes("COUNTY")) return cleaned;

  return `${cleaned} COUNTY`;
}

function buildQueryParams(parsed: ParsedUsQuery): URLSearchParams {
  const zip = parsed.zip?.replace(/\D/g, "").slice(0, 5);
  const county = normalizeCounty(parsed.county);

  if (!zip && !county && !parsed.city) {
    throw new Error(
      "Virginia Sex Offender Registry requires a county or ZIP (e.g. John Smith, Fairfax County, VA or John Smith, 22030).",
    );
  }

  if (!parsed.firstName || !parsed.lastName) {
    throw new Error(
      "Enter first and last name for Virginia Sex Offender Registry search (e.g. John Smith, Fairfax County, VA).",
    );
  }

  return new URLSearchParams({
    Filter: "None",
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    registrationNumber: "",
    Address: "",
    City: (parsed.city || "").toUpperCase(),
    County: county || "",
    Zip: zip || "",
    IncludeContiguousZips: zip ? "true" : "false",
  });
}

function datatableBody() {
  return {
    draw: 1,
    columns: [
      "imageUrl",
      "fullName",
      "age",
      "addressType",
      "location",
      "city",
      "postalCode",
      "county",
      "id",
    ].map((data, index) => ({
      data,
      searchable: true,
      orderable: index === 1 || index === 2,
      search: { value: "", regex: false },
    })),
    order: [{ column: 1, dir: "asc" as const }],
    start: 0,
    length: 25,
    search: { value: "", regex: false },
  };
}

export async function searchVaSexOffenderRegistry(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<PersonHit[]> {
  const params = buildQueryParams(parsed);
  const qs = params.toString();
  const key = cacheKey("va-sor", qs);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  await paceSource("va-sor", 1200);

  let cookie = "";
  const landing = await fetchWithTimeout(`${BASE}/Search`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-sor"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
    },
  });

  cookie = mergeCookies(cookie, readSetCookies(landing.headers));
  const landingHtml = await landing.text();
  const landingToken = extractToken(landingHtml);

  const resultsPage = await fetchWithTimeout(`${BASE}/Search/Results?${qs}`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-sor"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/Search`,
    },
  });

  cookie = mergeCookies(cookie, readSetCookies(resultsPage.headers));
  const resultsHtml = await resultsPage.text();
  const token = extractToken(resultsHtml) || landingToken;

  if (!token) {
    throw new Error(
      "Virginia Sex Offender Registry antiforgery token unavailable.",
    );
  }

  const apiRes = await fetchWithTimeout(`${BASE}/search/searchRegistry?${qs}`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-sor"].timeoutMs,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Origin: BASE,
      Referer: `${BASE}/Search/Results?${qs}`,
      RequestVerificationToken: token,
      Cookie: cookie,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(datatableBody()),
  });

  const text = await apiRes.text();

  if (!apiRes.ok) {
    throw new Error(`Virginia Sex Offender Registry HTTP ${apiRes.status}`);
  }

  let data: VaSorResponse;

  try {
    data = JSON.parse(text) as VaSorResponse;
  } catch {
    throw new Error("Virginia Sex Offender Registry returned invalid JSON.");
  }

  if (data.Message && !data.offenders) {
    throw new Error(data.Message);
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data.offenders ?? [])
    .slice(0, limit)
    .map((row, index) => {
      const id = row.id || `va-sor-${index}`;
      const name =
        row.fullName ||
        [row.firstName, row.middleName, row.lastName]
          .filter(Boolean)
          .join(" ") ||
        `${parsed.firstName} ${parsed.lastName}`;
      const location = [row.location, row.city, row.county, row.postalCode]
        .filter(Boolean)
        .join(", ");

      return {
        id,
        name,
        kind: "sex-offender",
        subtitle:
          [row.addressType, row.age != null ? `Age ${row.age}` : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        state: "VA",
        details: [
          ...(row.age != null
            ? [{ label: "Age", value: String(row.age) }]
            : []),
          ...(row.addressType
            ? [{ label: "Address type", value: row.addressType }]
            : []),
          ...(location
            ? [{ label: "Registered location", value: location }]
            : []),
          ...(row.county
            ? [{ label: "County / city", value: row.county }]
            : []),
          ...(row.postalCode ? [{ label: "ZIP", value: row.postalCode }] : []),
        ],
        source: {
          id: "va-sor",
          label: "Virginia Sex Offender Registry",
          jurisdiction: "Virginia State Police public registry",
          retrievedAt,
          deepLink: `${BASE}/Offender/Details/${id}`,
          confidence: "high",
        },
      };
    });

  setCached(key, hits, SOURCE_LIMITS["va-sor"].ttlMs);

  return hits;
}
