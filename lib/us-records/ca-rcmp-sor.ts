import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

const LIST_URL =
  "https://rcmp.ca/en/high-risk-child-sex-offender-database/search-database?g=All&ptid=502";
const PROFILE_BASE =
  "https://rcmp.ca/en/high-risk-child-sex-offender-database/search-database";

const SKIP_HEADINGS =
  /language|search|royal|note|warning|filter|you are|offender profiles|high risk/i;

type RcmpCard = {
  id: string;
  name: string;
  href: string;
};

function stripHtml(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseListCards(html: string): RcmpCard[] {
  const ids = [
    ...new Set(
      [
        ...html.matchAll(
          /\/en\/high-risk-child-sex-offender-database\/search-database\/(\d+)/g,
        ),
      ].map((m) => m[1]!),
    ),
  ];
  const headings = [
    ...html.matchAll(/<h[23][^>]*>\s*([^<]{3,90})\s*<\/h[23]>/gi),
  ]
    .map((m) => m[1]!.replace(/\s+/g, " ").trim())
    .filter((name) => !SKIP_HEADINGS.test(name));

  const cards: RcmpCard[] = [];

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    const name = headings[i] || `Offender ${id}`;

    cards.push({
      id,
      name,
      href: `${PROFILE_BASE}/${id}`,
    });
  }

  return cards;
}

function extractField(lines: string[], label: string): string | undefined {
  const idx = lines.findIndex(
    (line) => line.toLowerCase() === label.toLowerCase(),
  );

  if (idx < 0) return undefined;
  const next = lines[idx + 1];

  if (
    !next ||
    /^(personal information|description|conditions|place)/i.test(next)
  ) {
    return undefined;
  }

  return next;
}

function extractOffences(lines: string[]): string | undefined {
  const start = lines.findIndex((line) =>
    /description of offences/i.test(line),
  );

  if (start < 0) return undefined;
  const offences: string[] = [];

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (/^(conditions|place of residence|date modified)/i.test(line)) break;
    if (line.length > 2 && line.length < 120) offences.push(line);
    if (offences.length >= 8) break;
  }

  return offences.length ? offences.join("; ") : undefined;
}

export function shouldSearchCaRcmpSor(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "CA") return false;
  if (parsed.country === "CA") return true;

  return /\b(canada|canadian|rcmp|ontario|quebec|alberta|manitoba|saskatchewan|yukon|nunavut|newfoundland|nova scotia|new brunswick|prince edward|british columbia|high[- ]?risk child sex)\b/i.test(
    parsed.raw,
  );
}

/**
 * Canada RCMP High Risk Child Sex Offender Database (public subset).
 * Not the full LE-only NSOR — only high-risk profiles already disclosed by police.
 * Optional locality/province from query filters after scrape.
 */
export async function searchCaRcmpSor(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];

  const key = cacheKey(
    "ca-rcmp-sor",
    `${needle}|${parsed.state || ""}|${parsed.city || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const html = await fetchUsRecordsText(LIST_URL, {
    source: "ca-rcmp-sor",
    minIntervalMs: 500,
    userAgent: BROWSER_UA,
    headers: {
      Referer: "https://rcmp.ca/en/high-risk-child-sex-offender-database",
    },
  });

  const cards = parseListCards(html)
    .map((card) => ({
      card,
      score: scoreNameMatch(card.name, needle),
    }))
    .filter((row) => row.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, 8));

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];

  for (const { card, score } of cards) {
    let age: string | undefined;
    let gender: string | undefined;
    let residence: string | undefined;
    let offences: string | undefined;

    try {
      const detailHtml = await fetchUsRecordsText(card.href, {
        source: "ca-rcmp-sor",
        minIntervalMs: 400,
        userAgent: BROWSER_UA,
        headers: { Referer: LIST_URL },
      });
      const lines = stripHtml(detailHtml);

      age = extractField(lines, "Age at time of original public notification");
      gender = extractField(lines, "Gender");
      residence = extractField(lines, "Place of residence");
      offences = extractOffences(lines);
    } catch {
      // List hit is still useful without detail enrichment.
    }

    if (parsed.city && residence) {
      if (!residence.toLowerCase().includes(parsed.city.toLowerCase())) {
        continue;
      }
    }

    hits.push({
      id: `ca-rcmp-sor-${card.id}`,
      name: card.name,
      kind: "sex-offender",
      subtitle:
        [age ? `Age ${age}` : null, gender, residence, "Canada high-risk SOR"]
          .filter(Boolean)
          .join(" · ") || "Canada high-risk SOR",
      country: "CA",
      details: [
        ...(age ? [{ label: "Age at notification", value: age }] : []),
        ...(gender ? [{ label: "Gender", value: gender }] : []),
        ...(residence ? [{ label: "Residence", value: residence }] : []),
        ...(offences ? [{ label: "Offences", value: offences }] : []),
        { label: "Match score", value: String(score) },
        {
          label: "Scope",
          value: "High-risk child sex offenders only (not full Canadian NSOR)",
        },
      ],
      source: {
        id: "ca-rcmp-sor",
        label: "RCMP High Risk Child SOR",
        jurisdiction: "Canada",
        retrievedAt,
        deepLink: card.href,
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  setCached(key, hits, SOURCE_LIMITS["ca-rcmp-sor"].ttlMs);

  return hits;
}
