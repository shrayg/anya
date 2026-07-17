import { searchBopInmateLocator, shouldSearchBop } from "@/lib/us-records/bop-inmate";
import { searchCourtListener } from "@/lib/us-records/courtlistener";
import { buildCountryPortals } from "@/lib/us-records/country-portals";
import {
  searchDallasWanted,
  shouldSearchDallasWanted,
} from "@/lib/us-records/dallas-wanted";
import {
  searchDeCourtConnect,
  shouldSearchDeCourtConnect,
} from "@/lib/us-records/de-courtconnect";
import { searchFbiWanted } from "@/lib/us-records/fbi-wanted";
import {
  searchFlHover,
  shouldSearchFlHover,
} from "@/lib/us-records/fl-hover";
import { searchInterpolRedNotices } from "@/lib/us-records/interpol";
import { searchNppes } from "@/lib/us-records/nppes";
import { searchNsopw } from "@/lib/us-records/nsopw";
import { searchOfacSdn } from "@/lib/us-records/ofac-sdn";
import { searchOkOscn, shouldSearchOkOscn } from "@/lib/us-records/ok-oscn";
import {
  searchInMycase,
  shouldSearchInMycase,
} from "@/lib/us-records/in-mycase";
import {
  searchWiCcap,
  shouldSearchWiCcap,
} from "@/lib/us-records/wi-ccap";
import { searchPaUjs, shouldSearchPaUjs } from "@/lib/us-records/pa-ujs";
import { searchFlFdle, shouldSearchFlFdle } from "@/lib/us-records/fl-fdle";
import { searchOpenFec } from "@/lib/us-records/openfec";
import { hasOpenSanctionsKey, searchOpenSanctions } from "@/lib/us-records/opensanctions";
import {
  buildCandidateBacklogPortals,
  buildPriorityStatePortals,
} from "@/lib/us-records/priority-state-portals";
import {
  assertUsQuery,
  parseUsRecordsQuery,
} from "@/lib/us-records/query-parse";
import { searchSamExclusions } from "@/lib/us-records/sam-gov";
import {
  buildStateCourtPortals,
  buildStateSorPortals,
} from "@/lib/us-records/state-portals";
import { searchUnSanctions } from "@/lib/us-records/un-sanctions";
import { searchVaOcis, shouldSearchVaOcis } from "@/lib/us-records/va-ocis";
import { searchVaSexOffenderRegistry } from "@/lib/us-records/va-sor";
import type {
  CourtCaseHit,
  PersonHit,
  PublicPortalHit,
  PublicRecordsSearchResult,
  PublicRecordsSourceId,
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records/types";

type SettledSource<T> = {
  id: PublicRecordsSourceId;
  label: string;
  value?: T;
  error?: string;
};

async function settleSource<T>(
  id: PublicRecordsSourceId,
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

function collectErrors(parts: SettledSource<unknown>[]): Array<{
  id: PublicRecordsSourceId;
  label: string;
  message: string;
}> {
  return parts
    .filter((part) => part.error)
    .map((part) => ({
      id: part.id,
      label: part.label,
      message: part.error || "Unknown error",
    }));
}

function wantsVaSor(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "VA") return false;
  return Boolean(parsed.county || parsed.city || parsed.zip || parsed.state === "VA");
}

function wantsFlFdle(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  return shouldSearchFlFdle(parsed);
}

function wantsNsopw(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return Boolean(parsed.firstName && parsed.lastName);
}

function wantsUsFederal(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  return !parsed.country || parsed.country === "US";
}

function wantsPriorityStatePortals(
  parsed: ReturnType<typeof parseUsRecordsQuery>,
): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  return (
    !parsed.state ||
    ["MD", "FL", "TX", "NY", "DE", "VA", "OK", "PA", "IN", "WA", "NC", "WI"].includes(
      parsed.state,
    )
  );
}

function buildPortalLayer(parsed: ReturnType<typeof parseUsRecordsQuery>): PublicPortalHit[] {
  const portals: PublicPortalHit[] = [];
  if (!parsed.country || parsed.country === "US") {
    if (parsed.state) {
      portals.push(...buildStateCourtPortals(parsed));
      if (parsed.mode === "person") portals.push(...buildStateSorPortals(parsed));
    }
    if (wantsPriorityStatePortals(parsed)) {
      portals.push(...buildPriorityStatePortals(parsed));
      if (!parsed.state || ["MD", "FL", "TX", "NY"].includes(parsed.state)) {
        portals.push(...buildCandidateBacklogPortals(parsed, 20));
      }
    }
  }
  if (parsed.country && parsed.country !== "US") {
    portals.push(...buildCountryPortals(parsed));
  }
  return portals;
}

function composeResult(
  trimmed: string,
  parsed: ReturnType<typeof parseUsRecordsQuery>,
  people: PersonHit[],
  cases: CourtCaseHit[],
  portals: PublicPortalHit[],
  errors: ReturnType<typeof collectErrors>,
  emptyMessage: string,
): PublicRecordsSearchResult {
  const sources = uniqueSources([
    ...people.map((row) => row.source.label),
    ...cases.map((row) => row.source.label),
    ...portals.map((row) => row.source.label),
  ]);
  const count = people.length + cases.length + portals.length;
  return {
    query: trimmed,
    parsed,
    count,
    people,
    cases,
    portals,
    sources,
    errors,
    message:
      count === 0
        ? errors[0]?.message || emptyMessage
        : undefined,
  };
}

export async function searchUsCourt(query: string): Promise<UsCourtSearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const jobs: Array<Promise<SettledSource<CourtCaseHit[]>>> = [];
  if (wantsUsFederal(parsed)) {
    jobs.push(
      settleSource("courtlistener", "CourtListener / RECAP", () =>
        searchCourtListener(parsed, 15),
      ),
    );
  }
  if (shouldSearchVaOcis(parsed)) {
    jobs.push(
      settleSource("va-ocis", "Virginia OCIS", () => searchVaOcis(parsed, 15)),
    );
  }
  if (shouldSearchDeCourtConnect(parsed)) {
    jobs.push(
      settleSource("de-courtconnect", "Delaware CourtConnect", () =>
        searchDeCourtConnect(parsed, 15),
      ),
    );
  }
  if (shouldSearchOkOscn(parsed)) {
    jobs.push(
      settleSource("ok-oscn", "Oklahoma OSCN", () => searchOkOscn(parsed, 15)),
    );
  }
  if (shouldSearchFlHover(parsed)) {
    jobs.push(
      settleSource("fl-hover", "Hillsborough HOVER", () =>
        searchFlHover(parsed, 15),
      ),
    );
  }
  if (shouldSearchInMycase(parsed)) {
    jobs.push(
      settleSource("in-mycase", "Indiana MyCase", () =>
        searchInMycase(parsed, 15),
      ),
    );
  }
  if (shouldSearchWiCcap(parsed)) {
    jobs.push(
      settleSource("wi-ccap", "Wisconsin CCAP", () => searchWiCcap(parsed, 15)),
    );
  }
  if (shouldSearchPaUjs(parsed)) {
    jobs.push(
      settleSource("pa-ujs", "Pennsylvania UJS", () => searchPaUjs(parsed, 15)),
    );
  }

  const settled = await Promise.all(jobs);
  const cases = settled.flatMap((part) => part.value ?? []);
  const portals = buildPortalLayer(parsed);

  return composeResult(
    trimmed,
    parsed,
    [],
    cases,
    portals,
    collectErrors(settled),
    "No matching court matters were found.",
  );
}

export async function searchUsIdentity(
  query: string,
  options?: { includeCourt?: boolean; includeVaSor?: boolean },
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);
  const includeCourt = options?.includeCourt ?? true;
  const includeVaSor = options?.includeVaSor ?? wantsVaSor(parsed);

  const jobs: Array<Promise<SettledSource<PersonHit[] | CourtCaseHit[]>>> = [];

  if (wantsUsFederal(parsed)) {
    jobs.push(
      settleSource("openfec", "FEC OpenFEC", () => searchOpenFec(parsed, 8)),
      settleSource("nppes", "CMS NPPES", () => searchNppes(parsed, 8)),
      settleSource("ofac", "OFAC SDN", () => searchOfacSdn(parsed, 8)),
      settleSource("un-sanctions", "UN Sanctions", () => searchUnSanctions(parsed, 8)),
      settleSource("fbi-wanted", "FBI Wanted", () => searchFbiWanted(parsed, 8)),
      settleSource("sam-gov", "SAM.gov Exclusions", () => searchSamExclusions(parsed, 6)),
    );
  }

  if (shouldSearchBop(parsed)) {
    jobs.push(
      settleSource("bop-inmate", "BOP Inmate Locator", () =>
        searchBopInmateLocator(parsed, 8),
      ),
    );
  }

  if (shouldSearchDallasWanted(parsed)) {
    jobs.push(
      settleSource("dallas-wanted", "Dallas County Wanted", () =>
        searchDallasWanted(parsed, 8),
      ),
    );
  }

  jobs.push(
    settleSource("interpol", "Interpol Red Notices", () =>
      searchInterpolRedNotices(parsed, 8),
    ),
  );

  if (hasOpenSanctionsKey()) {
    jobs.push(
      settleSource("opensanctions", "OpenSanctions", () =>
        searchOpenSanctions(parsed, 10),
      ),
    );
  }

  if (wantsNsopw(parsed)) {
    jobs.push(
      settleSource("nsopw", "NSOPW National SOR", () => searchNsopw(parsed, 12)),
    );
  }

  if (includeVaSor && wantsVaSor(parsed)) {
    jobs.push(
      settleSource("va-sor", "Virginia Sex Offender Registry", () =>
        searchVaSexOffenderRegistry(parsed, 10),
      ),
    );
  }

  if (wantsFlFdle(parsed)) {
    jobs.push(
      settleSource("fl-fdle", "Florida FDLE SOR", () =>
        searchFlFdle(parsed, 10),
      ),
    );
  }

  if (includeCourt) {
    if (wantsUsFederal(parsed)) {
      jobs.push(
        settleSource("courtlistener", "CourtListener / RECAP", () =>
          searchCourtListener(parsed, 8),
        ),
      );
    }
    if (shouldSearchVaOcis(parsed)) {
      jobs.push(
        settleSource("va-ocis", "Virginia OCIS", () => searchVaOcis(parsed, 10)),
      );
    }
    if (shouldSearchDeCourtConnect(parsed)) {
      jobs.push(
        settleSource("de-courtconnect", "Delaware CourtConnect", () =>
          searchDeCourtConnect(parsed, 10),
        ),
      );
    }
    if (shouldSearchOkOscn(parsed)) {
      jobs.push(
        settleSource("ok-oscn", "Oklahoma OSCN", () => searchOkOscn(parsed, 10)),
      );
    }
    if (shouldSearchFlHover(parsed)) {
      jobs.push(
        settleSource("fl-hover", "Hillsborough HOVER", () =>
          searchFlHover(parsed, 10),
        ),
      );
    }
    if (shouldSearchInMycase(parsed)) {
      jobs.push(
        settleSource("in-mycase", "Indiana MyCase", () =>
          searchInMycase(parsed, 10),
        ),
      );
    }
    if (shouldSearchWiCcap(parsed)) {
      jobs.push(
        settleSource("wi-ccap", "Wisconsin CCAP", () =>
          searchWiCcap(parsed, 10),
        ),
      );
    }
    if (shouldSearchPaUjs(parsed)) {
      jobs.push(
        settleSource("pa-ujs", "Pennsylvania UJS", () =>
          searchPaUjs(parsed, 10),
        ),
      );
    }
  }

  const settled = await Promise.all(jobs);
  const people: PersonHit[] = [];
  const cases: CourtCaseHit[] = [];
  for (const part of settled) {
    if (!part.value) continue;
    if (
      part.id === "courtlistener" ||
      part.id === "va-ocis" ||
      part.id === "de-courtconnect" ||
      part.id === "ok-oscn" ||
      part.id === "fl-hover" ||
      part.id === "in-mycase" ||
      part.id === "wi-ccap" ||
      part.id === "pa-ujs"
    ) {
      cases.push(...(part.value as CourtCaseHit[]));
    } else {
      people.push(...(part.value as PersonHit[]));
    }
  }

  const portals = buildPortalLayer(parsed);
  return composeResult(
    trimmed,
    parsed,
    people,
    cases,
    portals,
    collectErrors(settled),
    "No public registry matches found for that query.",
  );
}

export async function searchUsNpd(query: string): Promise<UsIdentitySearchResult> {
  return searchUsIdentity(query, { includeCourt: true });
}

export async function searchUsVaSor(query: string): Promise<UsVaSorSearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const jobs = [
    settleSource("nsopw", "NSOPW National SOR", () => searchNsopw(parsed, 25)),
    settleSource("va-sor", "Virginia Sex Offender Registry", () =>
      searchVaSexOffenderRegistry(parsed, 25),
    ),
    settleSource("fl-fdle", "Florida FDLE SOR", () => searchFlFdle(parsed, 25)),
  ];

  const settled = await Promise.all(jobs);
  const people = settled.flatMap((part) => (part.value as PersonHit[]) ?? []);
  const errors = collectErrors(settled);
  const sources = uniqueSources(people.map((row) => row.source.label));

  return {
    query: trimmed,
    parsed,
    count: people.length,
    people,
    sources,
    errors,
    message:
      people.length === 0
        ? errors[0]?.message || "No sex offender registry matches found."
        : undefined,
  };
}

export async function searchSanctionsWatchlists(
  query: string,
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const jobs: Array<Promise<SettledSource<PersonHit[]>>> = [
    settleSource("ofac", "OFAC SDN", () => searchOfacSdn(parsed, 12)),
    settleSource("un-sanctions", "UN Sanctions", () => searchUnSanctions(parsed, 12)),
  ];
  if (hasOpenSanctionsKey()) {
    jobs.push(
      settleSource("opensanctions", "OpenSanctions", () =>
        searchOpenSanctions(parsed, 15),
      ),
    );
  }
  if (wantsUsFederal(parsed)) {
    jobs.push(
      settleSource("sam-gov", "SAM.gov Exclusions", () => searchSamExclusions(parsed, 8)),
    );
  }

  const settled = await Promise.all(jobs);
  const people = settled.flatMap((part) => part.value ?? []);
  const portals = buildCountryPortals(parsed).filter((row) =>
    row.title.toLowerCase().includes("sanctions"),
  );

  return composeResult(
    trimmed,
    parsed,
    people,
    [],
    portals,
    collectErrors(settled),
    "No sanctions or watchlist matches found.",
  );
}

export async function searchWantedPersons(query: string): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const settled = await Promise.all([
    settleSource("fbi-wanted", "FBI Wanted", () => searchFbiWanted(parsed, 12)),
    settleSource("interpol", "Interpol Red Notices", () =>
      searchInterpolRedNotices(parsed, 12),
    ),
    settleSource("dallas-wanted", "Dallas County Wanted", () =>
      searchDallasWanted(parsed, 12),
    ),
  ]);

  const people = settled.flatMap((part) => part.value ?? []);
  return composeResult(
    trimmed,
    parsed,
    people,
    [],
    [],
    collectErrors(settled),
    "No wanted-person matches found.",
  );
}

export async function searchInternationalRecordsDirectory(
  query: string,
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);
  const portals = buildCountryPortals(parsed);
  return composeResult(
    trimmed,
    parsed,
    [],
    [],
    portals,
    [],
    "No international registry portals available.",
  );
}

export async function searchStateRecordsDirectory(
  query: string,
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);
  const portals = [
    ...buildStateCourtPortals(parsed, { all: true }),
    ...buildStateSorPortals(parsed, { all: true }),
    ...buildPriorityStatePortals(parsed),
    ...buildCandidateBacklogPortals(parsed, 60),
  ];
  return composeResult(
    trimmed,
    parsed,
    [],
    [],
    portals,
    [],
    "No state registry portals available.",
  );
}

export async function searchPortalBacklogDirectory(
  query: string,
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);
  const portals = buildCandidateBacklogPortals(parsed, 120);
  return composeResult(
    trimmed,
    parsed,
    [],
    [],
    portals,
    [],
    "No portal backlog matches available.",
  );
}

export async function searchGlobalPublicRecords(
  query: string,
): Promise<UsIdentitySearchResult> {
  return searchUsIdentity(query, { includeCourt: true, includeVaSor: true });
}
