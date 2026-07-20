import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { getCached, setCached } from "@/lib/us-records/cache";
import {
  parseCsvLine,
  queryNeedle,
  scoreNameMatch,
} from "@/lib/us-records/name-match";
import { fetchUsRecordsText } from "@/lib/us-records/robots-and-limits";

type BulkEntry = {
  id: string;
  name: string;
  schema?: string;
  program?: string;
};

async function loadBulk(
  cacheKeyName: string,
  csvUrl: string,
  source: "au-dfat" | "ch-seco",
): Promise<BulkEntry[]> {
  const cached = getCached<BulkEntry[]>(cacheKeyName);

  if (cached) return cached;
  const csv = await fetchUsRecordsText(csvUrl, {
    source,
    minIntervalMs: 0,
  });
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0] || "");
  const nameIdx = header.findIndex((h) => /^name$/i.test(h.trim()));
  const idIdx = header.findIndex((h) => /^id$/i.test(h.trim()));
  const schemaIdx = header.findIndex((h) => /^schema$/i.test(h.trim()));
  const sanctionsIdx = header.findIndex((h) => /^sanctions$/i.test(h.trim()));
  const aliasesIdx = header.findIndex((h) => /^aliases$/i.test(h.trim()));
  const entries: BulkEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const name = (cols[nameIdx] || "").replace(/^"|"$/g, "").trim();

    if (!name) continue;
    const id = (cols[idIdx] || name).replace(/^"|"$/g, "");

    if (!seen.has(name.toUpperCase())) {
      seen.add(name.toUpperCase());
      entries.push({
        id,
        name,
        schema: (cols[schemaIdx] || "").replace(/^"|"$/g, "") || undefined,
        program: (cols[sanctionsIdx] || "").replace(/^"|"$/g, "") || undefined,
      });
    }
    const aliases = (cols[aliasesIdx] || "").replace(/^"|"$/g, "");

    for (const alias of aliases.split(";")) {
      const a = alias.trim();

      if (!a || seen.has(a.toUpperCase())) continue;
      seen.add(a.toUpperCase());
      entries.push({ id: `${id}:${a}`, name: a });
    }
  }
  setCached(cacheKeyName, entries, 24 * 60 * 60 * 1000);

  return entries;
}

async function searchBulk(
  sourceId: "au-dfat" | "ch-seco",
  label: string,
  jurisdiction: string,
  deepLink: string,
  csvUrl: string,
  cacheKeyName: string,
  parsed: ParsedPublicQuery,
  limit: number,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const index = await loadBulk(cacheKeyName, csvUrl, sourceId);
  const retrievedAt = new Date().toISOString();

  return index
    .map((entry) => ({ entry, score: scoreNameMatch(entry.name, needle) }))
    .filter((row) => row.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      id: `${sourceId}-${entry.id}`.slice(0, 180),
      name: entry.name,
      kind: "sanctions" as const,
      subtitle:
        [entry.schema, entry.program].filter(Boolean).join(" · ") || label,
      details: [
        ...(entry.schema ? [{ label: "Type", value: entry.schema }] : []),
        ...(entry.program
          ? [{ label: "Program", value: entry.program.slice(0, 200) }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: sourceId,
        label,
        jurisdiction,
        retrievedAt,
        deepLink,
        confidence: (score >= 80 ? "high" : "medium") as "high" | "medium",
      },
    }));
}

export function searchAuDfat(parsed: ParsedPublicQuery, limit = 8) {
  return searchBulk(
    "au-dfat",
    "Australia DFAT Sanctions",
    "Australia",
    "https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list",
    "https://data.opensanctions.org/datasets/latest/au_dfat_sanctions/targets.simple.csv",
    "au-dfat:index-v1",
    parsed,
    limit,
  );
}

export function searchChSeco(parsed: ParsedPublicQuery, limit = 8) {
  return searchBulk(
    "ch-seco",
    "Switzerland SECO Sanctions",
    "Switzerland",
    "https://www.seco.admin.ch/en/searching-for-subjects-sanctions",
    "https://data.opensanctions.org/datasets/latest/ch_seco_sanctions/targets.simple.csv",
    "ch-seco:index-v1",
    parsed,
    limit,
  );
}
