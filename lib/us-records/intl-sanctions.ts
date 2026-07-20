import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { getCached, setCached } from "@/lib/us-records/cache";
import {
  decodeXml,
  parseCsvLine,
  queryNeedle,
  scoreNameMatch,
} from "@/lib/us-records/name-match";
import { fetchUsRecordsText } from "@/lib/us-records/robots-and-limits";

type ListEntry = { id: string; name: string; program?: string; type?: string };

const EU_URL =
  "https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw";
const UK_URL =
  "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv";
const CA_URL =
  "https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml";

async function loadEuIndex(): Promise<ListEntry[]> {
  const key = "eu-sanctions:index-v2";
  const cached = getCached<ListEntry[]>(key);

  if (cached) return cached;
  const xml = await fetchUsRecordsText(EU_URL, {
    source: "eu-sanctions",
    minIntervalMs: 0,
  });
  const entries: ListEntry[] = [];
  const seen = new Set<string>();

  for (const m of xml.matchAll(/\bwholeName="([^"]+)"/gi)) {
    const name = decodeXml(m[1] || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!name || seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    entries.push({
      id: name,
      name,
      type: "Listed",
      program: "EU financial sanctions",
    });
  }
  setCached(key, entries, 24 * 60 * 60 * 1000);

  return entries;
}

async function loadUkIndex(): Promise<ListEntry[]> {
  const key = "uk-sanctions:index-v1";
  const cached = getCached<ListEntry[]>(key);

  if (cached) return cached;
  const csv = await fetchUsRecordsText(UK_URL, {
    source: "uk-sanctions",
    minIntervalMs: 0,
  });
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  let headerIdx = lines.findIndex((l) => /Name 1/i.test(l));

  if (headerIdx < 0) headerIdx = 0;
  const header = parseCsvLine(lines[headerIdx] || "");
  const name1 = header.findIndex((h) => /^Name 1$/i.test(h.trim()));
  const name2 = header.findIndex((h) => /^Name 2$/i.test(h.trim()));
  const name6 = header.findIndex((h) => /^Name 6$/i.test(h.trim()));
  const group = header.findIndex((h) => /Group Type/i.test(h));
  const regime = header.findIndex((h) => /Regime/i.test(h));
  const entries: ListEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(headerIdx + 1)) {
    const cols = parseCsvLine(line);
    const parts = [
      name6 >= 0 ? cols[name6] : "",
      name1 >= 0 ? cols[name1] : "",
      name2 >= 0 ? cols[name2] : "",
    ]
      .map((p) => (p || "").replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    const name = parts.join(" ").replace(/\s+/g, " ").trim();

    if (!name || /^last updated$/i.test(name)) continue;
    if (seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    entries.push({
      id: name,
      name,
      type: (group >= 0 ? cols[group] : "")?.replace(/^"|"$/g, "") || "Listed",
      program:
        (regime >= 0 ? cols[regime] : "")?.replace(/^"|"$/g, "") ||
        "UK OFSI consolidated list",
    });
  }
  setCached(key, entries, 24 * 60 * 60 * 1000);

  return entries;
}

async function loadCaIndex(): Promise<ListEntry[]> {
  const key = "ca-sanctions:index-v2";
  const cached = getCached<ListEntry[]>(key);

  if (cached) return cached;
  const xml = await fetchUsRecordsText(CA_URL, {
    source: "ca-sanctions",
    minIntervalMs: 0,
  });
  const entries: ListEntry[] = [];
  const seen = new Set<string>();

  for (const m of xml.matchAll(
    /<LastName>([^<]*)<\/LastName>\s*<GivenName>([^<]*)<\/GivenName>/gi,
  )) {
    const name = decodeXml(`${m[2] || ""} ${m[1] || ""}`)
      .replace(/\s+/g, " ")
      .trim();

    if (!name || seen.has(name.toUpperCase())) continue;
    seen.add(name.toUpperCase());
    entries.push({
      id: name,
      name,
      type: "Individual",
      program: "Canada SEMA",
    });
  }
  setCached(key, entries, 24 * 60 * 60 * 1000);

  return entries;
}

async function searchList(
  sourceId: "eu-sanctions" | "uk-sanctions" | "ca-sanctions",
  label: string,
  jurisdiction: string,
  deepLink: string,
  load: () => Promise<ListEntry[]>,
  parsed: ParsedPublicQuery,
  limit: number,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];
  const index = await load();
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
        [entry.type, entry.program].filter(Boolean).join(" · ") || undefined,
      details: [
        ...(entry.type ? [{ label: "Type", value: entry.type }] : []),
        ...(entry.program ? [{ label: "Program", value: entry.program }] : []),
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

export function searchEuSanctions(parsed: ParsedPublicQuery, limit = 8) {
  return searchList(
    "eu-sanctions",
    "EU Consolidated Sanctions",
    "European Union",
    "https://www.sanctionsmap.eu/",
    loadEuIndex,
    parsed,
    limit,
  );
}

export function searchUkSanctions(parsed: ParsedPublicQuery, limit = 8) {
  return searchList(
    "uk-sanctions",
    "UK OFSI Sanctions",
    "United Kingdom",
    "https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets",
    loadUkIndex,
    parsed,
    limit,
  );
}

export function searchCaSanctions(parsed: ParsedPublicQuery, limit = 8) {
  return searchList(
    "ca-sanctions",
    "Canada SEMA Sanctions",
    "Canada",
    "https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx?lang=eng",
    loadCaIndex,
    parsed,
    limit,
  );
}
