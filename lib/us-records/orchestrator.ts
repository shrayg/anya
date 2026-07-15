import { searchCourtListener } from "@/lib/us-records/courtlistener";
import { searchNppes } from "@/lib/us-records/nppes";
import { searchOfacSdn } from "@/lib/us-records/ofac-sdn";
import { searchOpenFec } from "@/lib/us-records/openfec";
import {
  assertUsQuery,
  parseUsRecordsQuery,
} from "@/lib/us-records/query-parse";
import type {
  CourtCaseHit,
  PersonHit,
  SourceError,
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsRecordsSourceId,
} from "@/lib/us-records/types";

type SettledSource<T> = {
  id: UsRecordsSourceId;
  label: string;
  value?: T;
  error?: string;
};

async function settleSource<T>(
  id: UsRecordsSourceId,
  label: string,
  work: () => Promise<T>,
): Promise<SettledSource<T>> {
  try {
    return { id, label, value: await work() };
  } catch (err) {
    return {
      id,
      label,
      error: err instanceof Error ? err.message : `${label} failed`,
    };
  }
}

function uniqueSources(labels: string[]): string[] {
  return [...new Set(labels)];
}

function collectErrors(parts: SettledSource<unknown>[]): SourceError[] {
  return parts
    .filter((part) => part.error)
    .map((part) => ({
      id: part.id,
      label: part.label,
      message: part.error || "Unknown error",
    }));
}

export async function searchUsCourt(query: string): Promise<UsCourtSearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const court = await settleSource("courtlistener", "CourtListener / RECAP", () =>
    searchCourtListener(parsed, 15),
  );

  const cases = court.value ?? [];
  const errors = collectErrors([court]);
  const sources = uniqueSources(cases.map((row) => row.source.label));

  return {
    query: trimmed,
    parsed,
    count: cases.length,
    cases,
    sources,
    errors,
    message:
      cases.length === 0
        ? errors[0]?.message ||
          "No matching federal dockets were found in the RECAP / CourtListener index."
        : undefined,
  };
}

export async function searchUsIdentity(
  query: string,
  options?: { includeCourt?: boolean },
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);
  const includeCourt = options?.includeCourt ?? true;

  const jobs: Array<Promise<SettledSource<PersonHit[] | CourtCaseHit[]>>> = [
    settleSource("openfec", "FEC OpenFEC", () => searchOpenFec(parsed, 8)),
    settleSource("nppes", "CMS NPPES", () => searchNppes(parsed, 8)),
    settleSource("ofac", "OFAC SDN", () => searchOfacSdn(parsed, 8)),
  ];

  if (includeCourt) {
    jobs.push(
      settleSource("courtlistener", "CourtListener / RECAP", () =>
        searchCourtListener(parsed, 8),
      ),
    );
  }

  const settled = await Promise.all(jobs);
  const people: PersonHit[] = [];
  const cases: CourtCaseHit[] = [];

  for (const part of settled) {
    if (!part.value) continue;
    if (part.id === "courtlistener") {
      cases.push(...(part.value as CourtCaseHit[]));
    } else {
      people.push(...(part.value as PersonHit[]));
    }
  }

  const errors = collectErrors(settled);
  const sources = uniqueSources([
    ...people.map((row) => row.source.label),
    ...cases.map((row) => row.source.label),
  ]);

  const count = people.length + cases.length;

  return {
    query: trimmed,
    parsed,
    count,
    people,
    cases,
    sources,
    errors,
    message:
      count === 0
        ? errors.length > 0
          ? "No public-identity hits returned. Some sources reported errors."
          : "No public registry matches found for that query."
        : undefined,
  };
}

export async function searchUsNpd(query: string): Promise<UsIdentitySearchResult> {
  const result = await searchUsIdentity(query, { includeCourt: true });
  return {
    ...result,
    message:
      result.count === 0
        ? result.message
        : result.message,
  };
}
