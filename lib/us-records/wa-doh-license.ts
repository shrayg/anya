import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  fetchUsRecordsJson,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

type WaDohRow = {
  credentialnumber?: string;
  lastname?: string;
  firstname?: string;
  middlename?: string;
  credentialtype?: string;
  status?: string;
  birthyear?: string;
  firstissuedate?: string;
  expirationdate?: string;
  actiontaken?: string;
};

export function shouldSearchWaDoh(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "WA") return false;
  if (parsed.state === "WA") return true;
  return /\b(washington|wa\b|doh|credential|nurse|rn\b|lpn)\b/i.test(parsed.raw);
}

/**
 * Washington DOH health-care provider credentials via Open Data (Socrata).
 * Optional credential-type / status filters via free-text; state/city optional.
 */
export async function searchWaDohLicense(
  parsed: ParsedPublicQuery,
  limit = 10,
): Promise<PersonHit[]> {
  const first = (parsed.firstName || "").trim();
  const last = (parsed.lastName || "").trim();
  if (!last || last.length < 2) {
    throw new Error(
      "WA DOH license search needs a last name (e.g. John Smith, WA).",
    );
  }

  const key = cacheKey(
    "wa-doh-license",
    `${first}|${last}|${parsed.city || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  const clauses = [
    `upper(lastname) like '${last.replace(/'/g, "''").toUpperCase()}%'`,
  ];
  if (first) {
    clauses.push(
      `upper(firstname) like '${first.replace(/'/g, "''").toUpperCase()}%'`,
    );
  }

  const url =
    `https://data.wa.gov/resource/qxh8-f4bd.json?` +
    new URLSearchParams({
      $where: clauses.join(" AND "),
      $limit: String(Math.min(limit * 3, 40)),
      $order: "lastname,firstname",
    }).toString();

  const rows = await fetchUsRecordsJson<WaDohRow[]>(url, {
    source: "wa-doh-license",
    minIntervalMs: 350,
  });

  const needle = queryNeedle(parsed) || `${first} ${last}`.trim();
  const retrievedAt = new Date().toISOString();
  const hits = (rows || [])
    .map((row) => {
      const name = [row.firstname, row.middlename, row.lastname]
        .filter(Boolean)
        .join(" ");
      return { row, name, score: scoreNameMatch(name, needle) };
    })
    .filter((r) => r.name && r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row, name, score }) => ({
      id: `wa-doh-${row.credentialnumber || name}`.slice(0, 180),
      name,
      kind: "provider" as const,
      subtitle: [row.credentialtype, row.status].filter(Boolean).join(" · "),
      state: "WA",
      country: "US",
      details: [
        ...(row.credentialnumber
          ? [{ label: "Credential #", value: row.credentialnumber }]
          : []),
        ...(row.credentialtype
          ? [{ label: "Type", value: row.credentialtype }]
          : []),
        ...(row.status ? [{ label: "Status", value: row.status }] : []),
        ...(row.birthyear ? [{ label: "Birth year", value: row.birthyear }] : []),
        ...(row.firstissuedate
          ? [{ label: "First issued", value: row.firstissuedate }]
          : []),
        ...(row.expirationdate
          ? [{ label: "Expires", value: row.expirationdate }]
          : []),
        ...(row.actiontaken && row.actiontaken !== "No"
          ? [{ label: "Action taken", value: row.actiontaken }]
          : []),
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "wa-doh-license" as const,
        label: "WA DOH Credentials",
        jurisdiction: "Washington",
        retrievedAt,
        deepLink:
          "https://doh.wa.gov/licenses-permits-and-certificates/provider-credential-or-facility-search",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    }));

  setCached(key, hits, SOURCE_LIMITS["wa-doh-license"].ttlMs);
  return hits;
}
