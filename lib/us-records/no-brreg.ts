import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle } from "@/lib/us-records/name-match";
import { fetchUsRecordsJson } from "@/lib/us-records/robots-and-limits";

type BrregUnit = {
  organisasjonsnummer?: string | number;
  navn?: string;
  organisasjonsform?: { beskrivelse?: string };
  forretningsadresse?: { kommune?: string; poststed?: string };
};

type BrregResponse = {
  _embedded?: { enheter?: BrregUnit[] };
};

export async function searchNoBrreg(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const key = cacheKey("no-brreg", `${needle}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const url =
    `https://data.brreg.no/enhetsregisteret/api/enheter?` +
    new URLSearchParams({
      navn: needle,
      size: String(Math.min(limit, 20)),
    }).toString();

  const data = await fetchUsRecordsJson<BrregResponse>(url, {
    source: "no-brreg",
    minIntervalMs: 300,
    headers: { Accept: "application/json" },
  });

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (data._embedded?.enheter || [])
    .slice(0, limit)
    .map((row) => ({
      id: `no-brreg-${row.organisasjonsnummer || row.navn}`,
      name: row.navn || needle,
      kind: "business" as const,
      subtitle: row.organisasjonsform?.beskrivelse || "Norwegian entity",
      country: "NO",
      details: [
        ...(row.organisasjonsnummer
          ? [{ label: "Org number", value: String(row.organisasjonsnummer) }]
          : []),
        ...(row.forretningsadresse?.kommune
          ? [{ label: "Municipality", value: row.forretningsadresse.kommune }]
          : []),
        ...(row.forretningsadresse?.poststed
          ? [{ label: "City", value: row.forretningsadresse.poststed }]
          : []),
      ],
      source: {
        id: "no-brreg",
        label: "Norway Brønnøysund",
        jurisdiction: "Norway",
        retrievedAt,
        deepLink: row.organisasjonsnummer
          ? `https://virksomhet.brreg.no/nb/oppslag/enheter/${row.organisasjonsnummer}`
          : "https://www.brreg.no/",
        confidence: "high" as const,
      },
    }));

  setCached(key, hits, 6 * 60 * 60 * 1000);

  return hits;
}
