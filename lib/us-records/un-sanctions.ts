import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { getCached, setCached } from "@/lib/us-records/cache";
import {
  fetchUsRecordsText,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

const UN_XML_URL =
  "https://scsanctions.un.org/resources/xml/en/consolidated.xml";

const INDEX_CACHE_KEY = "un-sanctions:index-v1";

type UnEntry = {
  id: string;
  name: string;
  type: string;
  program: string;
};

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function loadUnIndex(): Promise<UnEntry[]> {
  const cached = getCached<UnEntry[]>(INDEX_CACHE_KEY);

  if (cached) return cached;

  let xml: string;

  try {
    xml = await fetchUsRecordsText(UN_XML_URL, {
      source: "un-sanctions",
      minIntervalMs: 0,
    });
  } catch {
    // Fallback mirror used by many compliance stacks.
    xml = await fetchUsRecordsText(
      "https://www.un.org/securitycouncil/sites/www.un.org.securitycouncil/files/consolidated.xml",
      { source: "un-sanctions", minIntervalMs: 0 },
    );
  }

  const entries: UnEntry[] = [];
  const blocks =
    xml.match(
      /<INDIVIDUAL>[\s\S]*?<\/INDIVIDUAL>|<ENTITY>[\s\S]*?<\/ENTITY>/gi,
    ) || [];

  for (const block of blocks) {
    const id =
      block.match(/<DATAID>([^<]+)<\/DATAID>/i)?.[1] ||
      block.match(/<REFERENCE_NUMBER>([^<]+)<\/REFERENCE_NUMBER>/i)?.[1] ||
      "";
    const name =
      block.match(/<FIRST_NAME>([^<]*)<\/FIRST_NAME>/i)?.[1] !== undefined
        ? [
            block.match(/<FIRST_NAME>([^<]*)<\/FIRST_NAME>/i)?.[1],
            block.match(/<SECOND_NAME>([^<]*)<\/SECOND_NAME>/i)?.[1],
            block.match(/<THIRD_NAME>([^<]*)<\/THIRD_NAME>/i)?.[1],
            block.match(/<FOURTH_NAME>([^<]*)<\/FOURTH_NAME>/i)?.[1],
          ]
            .filter(Boolean)
            .join(" ")
        : block.match(/<FIRST_NAME>([^<]+)<\/FIRST_NAME>/i)?.[1] ||
          block.match(/<NAME>([^<]+)<\/NAME>/i)?.[1] ||
          "";
    const cleanName = decodeXml(name).replace(/\s+/g, " ").trim();

    if (!cleanName) continue;
    const type = block.startsWith("<ENTITY") ? "Entity" : "Individual";
    const program = decodeXml(
      block.match(/<UN_LIST_TYPE>([^<]+)<\/UN_LIST_TYPE>/i)?.[1] || "UN SC",
    );

    entries.push({ id: id || cleanName, name: cleanName, type, program });
  }

  setCached(INDEX_CACHE_KEY, entries, SOURCE_LIMITS["un-sanctions"].ttlMs);

  return entries;
}

function scoreNameMatch(haystack: string, needle: string): number {
  const h = haystack.toUpperCase();
  const n = needle
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!n) return 0;
  if (h === n) return 100;
  if (h.includes(n)) return 80;
  const tokens = n.split(" ").filter(Boolean);

  if (!tokens.length) return 0;
  const matched = tokens.filter((token) => h.includes(token)).length;

  return Math.round((matched / tokens.length) * 60);
}

export async function searchUnSanctions(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = parsed.fullName || parsed.lastName || parsed.raw;

  if (!needle || needle.length < 2) return [];

  const index = await loadUnIndex();
  const retrievedAt = new Date().toISOString();

  return index
    .map((entry) => ({ entry, score: scoreNameMatch(entry.name, needle) }))
    .filter((row) => row.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      id: `un-${entry.id}`,
      name: entry.name,
      kind: "sanctions" as const,
      subtitle: `${entry.type} · ${entry.program}`,
      country: parsed.country,
      details: [
        { label: "List", value: entry.program },
        { label: "Type", value: entry.type },
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "un-sanctions",
        label: "UN Security Council Sanctions",
        jurisdiction: "United Nations consolidated list",
        retrievedAt,
        deepLink: "https://www.un.org/securitycouncil/sanctions/information",
        confidence: score >= 80 ? "high" : "medium",
      },
    }));
}
