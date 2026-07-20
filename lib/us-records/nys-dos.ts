import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type NysEntity = {
  dos_id?: string;
  current_entity_name?: string;
  initial_dos_filing_date?: string;
  county?: string;
  jurisdiction?: string;
  entity_type?: string;
  dos_process_name?: string;
  dos_process_address_1?: string;
  dos_process_city?: string;
  dos_process_state?: string;
  dos_process_zip?: string;
  chairman_name?: string;
  entity_status?: string;
};

export function shouldSearchNysDos(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "NY") return false;
  if (parsed.state === "NY") return true;

  return /\b(nys|new york|dos|suny|llc|inc\.?|corp)\b/i.test(parsed.raw);
}

/**
 * New York Department of State — Active Corporations open data (Socrata).
 * Optional county/city/ZIP filters when known.
 */
export async function searchNysDos(
  parsed: ParsedPublicQuery,
  limit = 8,
): Promise<PersonHit[]> {
  const needle = queryNeedle(parsed);

  if (!needle || needle.length < 2) return [];

  const key = cacheKey(
    "nys-dos",
    `${needle}|${parsed.county || ""}|${parsed.city || ""}|${parsed.zip || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  const clauses = [
    `upper(current_entity_name) like '%${needle.replace(/'/g, "''").toUpperCase()}%'`,
  ];

  if (parsed.county) {
    const county = parsed.county
      .replace(/\s+County$/i, "")
      .trim()
      .toUpperCase();

    clauses.push(`upper(county) like '%${county.replace(/'/g, "''")}%'`);
  }
  if (parsed.city) {
    clauses.push(
      `upper(dos_process_city) like '%${parsed.city.replace(/'/g, "''").toUpperCase()}%'`,
    );
  }
  if (parsed.zip) {
    clauses.push(`dos_process_zip='${parsed.zip.replace(/'/g, "''")}'`);
  }

  const url =
    `https://data.ny.gov/resource/n9v6-gdp6.json?` +
    new URLSearchParams({
      $where: clauses.join(" AND "),
      $limit: String(Math.min(limit * 3, 30)),
      $order: "initial_dos_filing_date DESC",
    }).toString();

  const rows = await fetchUsRecordsJson<NysEntity[]>(url, {
    source: "nys-dos",
    minIntervalMs: 350,
  });

  const retrievedAt = new Date().toISOString();
  const hits = (rows || [])
    .map((row) => ({
      row,
      score: scoreNameMatch(row.current_entity_name || "", needle),
    }))
    .filter((r) => r.row.current_entity_name && r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, score }) => {
      const address = [
        row.dos_process_address_1,
        row.dos_process_city,
        row.dos_process_state,
        row.dos_process_zip,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        id: `nys-dos-${row.dos_id || row.current_entity_name}`.slice(0, 180),
        name: row.current_entity_name || needle,
        kind: "business" as const,
        subtitle: [row.entity_type, row.county, row.entity_status]
          .filter(Boolean)
          .join(" · "),
        state: "NY",
        country: "US",
        details: [
          ...(row.dos_id ? [{ label: "DOS ID", value: row.dos_id }] : []),
          ...(row.entity_type
            ? [{ label: "Entity type", value: row.entity_type }]
            : []),
          ...(row.county ? [{ label: "County", value: row.county }] : []),
          ...(row.chairman_name
            ? [{ label: "Chairman", value: row.chairman_name }]
            : []),
          ...(address ? [{ label: "Process address", value: address }] : []),
          ...(row.initial_dos_filing_date
            ? [
                {
                  label: "Filed",
                  value: row.initial_dos_filing_date.slice(0, 10),
                },
              ]
            : []),
          { label: "Match score", value: String(score) },
        ],
        source: {
          id: "nys-dos" as const,
          label: "NY DOS Corporations",
          jurisdiction: "New York",
          retrievedAt,
          deepLink: "https://apps.dos.ny.gov/publicInquiry/",
          confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
        },
      };
    });

  setCached(key, hits, SOURCE_LIMITS["nys-dos"].ttlMs);

  return hits;
}
