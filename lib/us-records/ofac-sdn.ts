import { getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

const SDN_URL =
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";

type OfacEntry = {
  entNum: string;
  name: string;
  type: string;
  program: string;
  remarks: string;
};

const INDEX_CACHE_KEY = "ofac:sdn-index-v1";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

async function loadOfacIndex(): Promise<OfacEntry[]> {
  const cached = getCached<OfacEntry[]>(INDEX_CACHE_KEY);
  if (cached) return cached;

  const csv = await fetchUsRecordsText(SDN_URL, {
    source: "ofac",
    minIntervalMs: 0,
  });

  const entries: OfacEntry[] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    // SDN.CSV typically: ent_num,SDN_Name,SDN_Type,Program,Title,...,Remarks
    if (cols.length < 4) continue;
    const entNum = cols[0]?.replace(/^"|"$/g, "").trim();
    const name = cols[1]?.replace(/^"|"$/g, "").trim();
    if (!entNum || !name || entNum.toLowerCase() === "ent_num") continue;

    entries.push({
      entNum,
      name,
      type: cols[2]?.replace(/^"|"$/g, "").trim() || "Unknown",
      program: cols[3]?.replace(/^"|"$/g, "").trim() || "",
      remarks: (cols[cols.length - 1] || "").replace(/^"|"$/g, "").trim(),
    });
  }

  setCached(INDEX_CACHE_KEY, entries, SOURCE_LIMITS.ofac.ttlMs);
  return entries;
}

function scoreNameMatch(haystack: string, needle: string): number {
  const h = haystack.toUpperCase();
  const n = needle.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return 0;
  if (h === n) return 100;
  if (h.includes(n)) return 80;

  const nTokens = n.split(" ").filter(Boolean);
  if (nTokens.length === 0) return 0;
  const matched = nTokens.filter((token) => h.includes(token)).length;
  return Math.round((matched / nTokens.length) * 60);
}

export async function searchOfacSdn(
  parsed: ParsedUsQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = parsed.fullName || parsed.lastName || parsed.raw;
  if (!needle || needle.length < 2) return [];

  const index = await loadOfacIndex();
  const retrievedAt = new Date().toISOString();

  const ranked = index
    .map((entry) => ({ entry, score: scoreNameMatch(entry.name, needle) }))
    .filter((row) => row.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map(({ entry, score }) => ({
    id: `ofac-${entry.entNum}`,
    name: entry.name,
    kind: "sanctions" as const,
    subtitle: [entry.type, entry.program].filter(Boolean).join(" · ") || undefined,
    details: [
      { label: "Entity number", value: entry.entNum },
      { label: "Type", value: entry.type },
      ...(entry.program ? [{ label: "Program", value: entry.program }] : []),
      ...(entry.remarks ? [{ label: "Remarks", value: entry.remarks.slice(0, 280) }] : []),
      { label: "Match score", value: String(score) },
    ],
    source: {
      id: "ofac",
      label: "OFAC SDN",
      jurisdiction: "US Treasury sanctions",
      retrievedAt,
      deepLink: "https://sanctionssearch.ofac.treas.gov/",
      confidence: score >= 80 ? "high" : "medium",
    },
  }));
}

export async function probeOfac(): Promise<boolean> {
  try {
    const index = await loadOfacIndex();
    return index.length > 100;
  } catch {
    return false;
  }
}
