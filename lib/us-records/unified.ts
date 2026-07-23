import {
  breachHubRowsToCredentials,
  fetchBreachHubAdditiveBreachSearch,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  csintRowsToCredentials,
  detectCsintSearchType,
  fetchCsintAdditiveBreachSearch,
  isCsintEnabled,
} from "@/lib/csint";
import { fetchMelissaWithFallback } from "@/lib/gateway-fallback";
import { fetchGodsEyeSearchResult, resolveGodsEyeSearchType } from "@/lib/godseye";
import { withPrimaryFallback } from "@/lib/provider-dedupe";
import {
  mergeCombCredentialFields,
  type CombCredential,
  type CombSearchResult,
} from "@/lib/proxynova-comb";
import type {
  CourtCaseHit,
  PersonHit,
  PublicPortalHit,
  PublicRecordsSearchResult,
  SourceError,
} from "@/lib/us-records/types";
import {
  searchInternationalRecordsDirectory,
  searchNationalSor,
  searchPortalBacklogDirectory,
  searchSanctionsWatchlists,
  searchStateRecordsDirectory,
  searchUsCourt,
  searchUsIdentity,
  searchUsVaSor,
  searchWantedPersons,
} from "@/lib/us-records/orchestrator";
import { parseUsRecordsQuery } from "@/lib/us-records/query-parse";
import type { PublicRecordsSourceOptionId } from "@/lib/public-records/source-options";

const COMBINED_GODSEYE_TIMEOUT_MS = 18_000;
const COMBINED_CSINT_TIMEOUT_MS = 22_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 36_000;

export type UnifiedPublicRecordsResult = PublicRecordsSearchResult & {
  enabledSources: PublicRecordsSourceOptionId[];
  breaches: CombSearchResult | null;
  contactEnrich: Record<string, unknown> | null;
};

function emptyComb(query: string): CombSearchResult {
  return {
    source: "breach-indexes",
    query,
    start: 0,
    totalMatches: 0,
    returned: 0,
    credentials: [],
  };
}

function mergeCredentials(
  primary: CombCredential[],
  secondary: CombCredential[],
): CombCredential[] {
  const byKey = new Map<string, CombCredential>();

  for (const row of [...primary, ...secondary]) {
    const key = `${row.identifier.toLowerCase()}\0${row.secret}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    const fields = mergeCombCredentialFields(existing.fields, row.fields);
    const richerRaw =
      (row.raw?.length ?? 0) > (existing.raw?.length ?? 0) ? row.raw : existing.raw;

    byKey.set(key, {
      ...existing,
      raw: richerRaw,
      ...(fields ? { fields } : {}),
    });
  }

  return [...byKey.values()];
}

async function searchNameBreaches(query: string): Promise<CombSearchResult> {
  const csintType = detectCsintSearchType(query);

  const [gatewaySettled, godseyeSettled] = await Promise.allSettled([
    (async () => {
      const { value, used } = await withPrimaryFallback(
        async () => {
          if (!isBreachHubEnabled()) return null;

          return fetchBreachHubAdditiveBreachSearch(
            query,
            csintType,
            COMBINED_BREACHHUB_TIMEOUT_MS,
          );
        },
        async () => {
          if (!isCsintEnabled()) return null;

          return fetchCsintAdditiveBreachSearch(
            query,
            csintType as "email" | "phone" | "username" | "ip" | "auto",
            COMBINED_CSINT_TIMEOUT_MS,
          );
        },
        (row) => Boolean(row && row.count > 0),
      );

      if (used === "primary") {
        return { breachHub: value, csint: null as typeof value };
      }

      return { breachHub: null as typeof value, csint: value };
    })(),
    (async () => {
      try {
        const type = resolveGodsEyeSearchType(query);

        return await fetchGodsEyeSearchResult(
          type,
          query,
          COMBINED_GODSEYE_TIMEOUT_MS,
        );
      } catch {
        return null;
      }
    })(),
  ]);

  const gateway =
    gatewaySettled.status === "fulfilled" ? gatewaySettled.value : null;
  const godseye =
    godseyeSettled.status === "fulfilled" ? godseyeSettled.value : null;

  const breachHub = gateway?.breachHub ?? null;
  const csint = gateway?.csint ?? null;

  const credentials = [
    csint ? csintRowsToCredentials(csint.results) : [],
    breachHub ? breachHubRowsToCredentials(breachHub.results) : [],
    godseye ? breachHubRowsToCredentials(godseye.results) : [],
  ].reduce((acc, next) => mergeCredentials(acc, next), [] as CombCredential[]);

  const extras =
    (csint?.count ?? 0) + (breachHub?.count ?? 0) + (godseye?.count ?? 0);

  return {
    ...emptyComb(query),
    totalMatches: extras,
    returned: credentials.length,
    credentials,
  };
}

function dedupePeople(people: PersonHit[]): PersonHit[] {
  const seen = new Set<string>();
  const out: PersonHit[] = [];

  for (const row of people) {
    const key = `${row.source.id}|${row.id}|${row.name.toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function dedupeCases(cases: CourtCaseHit[]): CourtCaseHit[] {
  const seen = new Set<string>();
  const out: CourtCaseHit[] = [];

  for (const row of cases) {
    const key = `${row.source.id}|${row.id}|${row.caseName.toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function dedupePortals(portals: PublicPortalHit[]): PublicPortalHit[] {
  const seen = new Set<string>();
  const out: PublicPortalHit[] = [];

  for (const row of portals) {
    const key = `${row.source.id}|${row.id}|${row.title.toLowerCase()}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function contactEnrichToPeople(
  query: string,
  payload: Record<string, unknown> | null,
): PersonHit[] {
  if (!payload) return [];

  const results = Array.isArray(payload.results) ? payload.results : [];
  const people: PersonHit[] = [];
  const retrievedAt = new Date().toISOString();

  for (let i = 0; i < results.length; i += 1) {
    const row = results[i];

    if (!row || typeof row !== "object") continue;

    const record = row as Record<string, unknown>;
    const name =
      [record.firstName, record.lastName].filter(Boolean).join(" ") ||
      (typeof record.name === "string" ? record.name : "") ||
      (typeof record.fullName === "string" ? record.fullName : "") ||
      query;

    const details: Array<{ label: string; value: string }> = [];

    for (const [label, key] of [
      ["Email", "email"],
      ["Phone", "phone"],
      ["Address", "address"],
      ["City", "city"],
      ["State", "state"],
      ["ZIP", "postal"],
    ] as const) {
      const value = record[key];

      if (typeof value === "string" && value.trim()) {
        details.push({ label, value: value.trim() });
      }
    }

    people.push({
      id: `contact-enrich-${i}`,
      name: String(name),
      kind: "other",
      subtitle: "Contact enrichment",
      details,
      source: {
        id: "state-portal",
        label: "Contact enrichment",
        retrievedAt,
        confidence: "medium",
      },
    });
  }

  return people;
}

export async function searchUnifiedPublicRecords(
  query: string,
  sources: PublicRecordsSourceOptionId[],
): Promise<UnifiedPublicRecordsResult> {
  const trimmed = query.trim().replace(/\s+/g, " ");

  if (!trimmed) {
    throw new Error("Enter a first and last name to search.");
  }

  const enabled = new Set(sources);
  const parsed = parseUsRecordsQuery(trimmed);
  const recordJobs: Array<Promise<PublicRecordsSearchResult>> = [];

  if (enabled.has("identity")) {
    recordJobs.push(
      searchUsIdentity(trimmed, {
        includeCourt: enabled.has("court"),
        includeVaSor: enabled.has("va-sor"),
      }),
    );
  } else {
    if (enabled.has("court")) {
      recordJobs.push(searchUsCourt(trimmed));
    }
    if (enabled.has("va-sor")) {
      recordJobs.push(searchUsVaSor(trimmed).then((result) => ({
        ...result,
        cases: [],
        portals: [],
      })));
    }
  }

  if (enabled.has("sanctions")) {
    recordJobs.push(searchSanctionsWatchlists(trimmed));
  }
  if (enabled.has("wanted")) {
    recordJobs.push(searchWantedPersons(trimmed));
  }
  if (enabled.has("national-sor")) {
    recordJobs.push(
      searchNationalSor(trimmed).then((result) => ({
        ...result,
        cases: [],
        portals: [],
      })),
    );
  }
  if (enabled.has("state-directory")) {
    recordJobs.push(searchStateRecordsDirectory(trimmed));
  }
  if (enabled.has("portal-backlog")) {
    recordJobs.push(searchPortalBacklogDirectory(trimmed));
  }
  if (enabled.has("intl-directory")) {
    recordJobs.push(searchInternationalRecordsDirectory(trimmed));
  }

  const breachJob = enabled.has("breaches")
    ? searchNameBreaches(trimmed)
    : Promise.resolve(null);
  const contactJob = enabled.has("contact-enrich")
    ? fetchMelissaWithFallback({
        first: parsed.firstName ?? "",
        last: parsed.lastName ?? "",
        input: trimmed,
        city: parsed.city ?? "",
        state: parsed.state ?? "",
        postal: parsed.zip ?? "",
      }).catch(() => null)
    : Promise.resolve(null);

  const [recordSettled, breaches, contactEnrich] = await Promise.all([
    Promise.allSettled(recordJobs),
    breachJob,
    contactJob,
  ]);

  const people: PersonHit[] = [];
  const cases: CourtCaseHit[] = [];
  const portals: PublicPortalHit[] = [];
  const errors: SourceError[] = [];
  const sourceLabels: string[] = [];

  for (const settled of recordSettled) {
    if (settled.status === "rejected") {
      errors.push({
        id: "state-portal",
        label: "Public Records",
        message:
          settled.reason instanceof Error
            ? settled.reason.message
            : "Source search failed",
      });
      continue;
    }

    const result = settled.value;
    people.push(...result.people);
    cases.push(...(result.cases ?? []));
    portals.push(...(result.portals ?? []));
    errors.push(...result.errors);
    sourceLabels.push(...result.sources);
  }

  const contactPeople = contactEnrichToPeople(
    trimmed,
    contactEnrich && typeof contactEnrich === "object"
      ? (contactEnrich as Record<string, unknown>)
      : null,
  );
  people.push(...contactPeople);

  if (contactPeople.length > 0) {
    sourceLabels.push("Contact enrichment");
  }

  const dedupedPeople = dedupePeople(people);
  const dedupedCases = dedupeCases(cases);
  const dedupedPortals = dedupePortals(portals);
  const breachPayload =
    breaches && breaches.returned > 0
      ? breaches
      : breaches
        ? { ...breaches, message: "No breach matches for this name." }
        : null;

  if (breachPayload && breachPayload.returned > 0) {
    sourceLabels.push("Breach & leak indexes");
  }

  const recordsCount =
    dedupedPeople.length + dedupedCases.length + dedupedPortals.length;
  const breachCount = breachPayload?.returned ?? 0;
  const count = recordsCount + breachCount;

  const uniqueSources = [...new Set(sourceLabels)];

  return {
    query: trimmed,
    parsed,
    count: recordsCount,
    people: dedupedPeople,
    cases: dedupedCases,
    portals: dedupedPortals,
    sources: uniqueSources,
    errors,
    message:
      count === 0
        ? errors[0]?.message ||
          "No public records, breach, or enrichment matches found."
        : undefined,
    enabledSources: sources,
    breaches: breachPayload,
    contactEnrich:
      contactEnrich && typeof contactEnrich === "object"
        ? (contactEnrich as Record<string, unknown>)
        : null,
  };
}
