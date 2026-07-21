import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

export function shouldSearchCalBar(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "CA") return false;
  if (parsed.state === "CA") return true;
  return /\b(calbar|california|attorney|esquire|bar\s*#?)\b/i.test(parsed.raw);
}

/**
 * State Bar of California attorney license search (HTML table twin).
 * Optional city filter when known.
 */
export async function searchCalBarLicense(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);
  if (!needle || needle.length < 2) {
    throw new Error(
      "CalBar search needs a name (e.g. John Smith, CA).",
    );
  }

  const key = cacheKey(
    "calbar-license",
    `${needle}|${parsed.city || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const url =
    "https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch?" +
    new URLSearchParams({
      FreeText: needle,
      SoundsLike: "false",
    }).toString();

  const html = await fetchUsRecordsText(url, {
    source: "calbar-license",
    minIntervalMs: 600,
    userAgent: BROWSER_UA,
    headers: {
      Referer: "https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch",
    },
  });

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];
  const rowRe =
    /<tr class="rowASRL(?:odd|even)">\s*<td>\s*<a href="(\/attorney\/Licensee\/Detail\/\d+)">\s*([^<]+?)\s*<\/a>\s*<\/td>\s*<td>\s*(?:<span[^>]*>)?\s*([^<]+?)\s*(?:<\/span>)?\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>\s*<td>\s*([^<]+?)\s*<\/td>/gi;

  for (const match of html.matchAll(rowRe)) {
    const href = match[1]!;
    const name = match[2]!.replace(/\s+/g, " ").trim();
    const status = match[3]!.replace(/\s+/g, " ").trim();
    const number = match[4]!.replace(/\s+/g, " ").trim();
    const city = match[5]!.replace(/\s+/g, " ").trim();
    const admitted = match[6]!.replace(/\s+/g, " ").trim();
    const score = scoreNameMatch(name, needle);
    if (score < 40) continue;
    if (parsed.city && !city.toLowerCase().includes(parsed.city.toLowerCase())) {
      continue;
    }
    hits.push({
      id: `calbar-${number || href}`,
      name,
      kind: "provider",
      subtitle: [status, city].filter(Boolean).join(" · "),
      state: "CA",
      country: "US",
      details: [
        ...(number ? [{ label: "Bar #", value: number }] : []),
        ...(status ? [{ label: "Status", value: status }] : []),
        ...(city ? [{ label: "City", value: city }] : []),
        ...(admitted ? [{ label: "Admitted", value: admitted }] : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "calbar-license",
        label: "State Bar of California",
        jurisdiction: "California",
        retrievedAt,
        deepLink: `https://apps.calbar.ca.gov${href}`,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  hits.sort(
    (a, b) =>
      Number(b.details.find((d) => d.label === "Match score")?.value || 0) -
      Number(a.details.find((d) => d.label === "Match score")?.value || 0),
  );

  setCached(key, hits, SOURCE_LIMITS["calbar-license"].ttlMs);
  return hits;
}
