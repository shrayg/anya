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

import {
  searchBopInmateLocator,
  shouldSearchBop,
} from "@/lib/us-records/bop-inmate";
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
import { searchFlHover, shouldSearchFlHover } from "@/lib/us-records/fl-hover";
import { searchInterpolRedNotices } from "@/lib/us-records/interpol";
import { searchNppes } from "@/lib/us-records/nppes";
import { searchNsopw } from "@/lib/us-records/nsopw";
import { searchOfacSdn } from "@/lib/us-records/ofac-sdn";
import {
  searchCaSanctions,
  searchEuSanctions,
  searchUkSanctions,
} from "@/lib/us-records/intl-sanctions";
import {
  searchAuDfat,
  searchChSeco,
} from "@/lib/us-records/intl-sanctions-bulk";
import {
  searchEuMostWanted,
  searchWorldBankDebarred,
} from "@/lib/us-records/intl-wanted-debarment";
import { searchNoBrreg } from "@/lib/us-records/no-brreg";
import { searchSecEdgar } from "@/lib/us-records/sec-edgar";
import { searchTxTdcj, shouldSearchTxTdcj } from "@/lib/us-records/tx-tdcj";
import {
  searchFlSunbiz,
  shouldSearchFlSunbiz,
} from "@/lib/us-records/fl-sunbiz";
import {
  searchNycAcris,
  searchNycPluto,
  searchPhillyOpa,
  searchKaneIlProperty,
  shouldSearchNycProperty,
  shouldSearchPhillyOpa,
  shouldSearchKaneIlProperty,
} from "@/lib/us-records/us-property-open";
import { searchUsaSpending } from "@/lib/us-records/usaspending";
import { searchNysDos, shouldSearchNysDos } from "@/lib/us-records/nys-dos";
import { searchIrsEoNonprofit } from "@/lib/us-records/irs-eo";
import {
  searchCaRcmpSor,
  shouldSearchCaRcmpSor,
} from "@/lib/us-records/ca-rcmp-sor";
import {
  searchWaDohLicense,
  shouldSearchWaDoh,
} from "@/lib/us-records/wa-doh-license";
import {
  searchCalBarLicense,
  shouldSearchCalBar,
} from "@/lib/us-records/calbar-license";
import {
  searchTxTdlrLicense,
  shouldSearchTxTdlr,
} from "@/lib/us-records/tx-tdlr";
import {
  searchDeaFugitives,
  shouldSearchDeaFugitives,
} from "@/lib/us-records/dea-fugitives";
import {
  searchFaaAircraft,
  shouldSearchFaaAircraft,
} from "@/lib/us-records/faa-aircraft";
import { searchFccUls, shouldSearchFccUls } from "@/lib/us-records/fcc-uls";
import {
  searchUsptoPtab,
  shouldSearchUsptoPtab,
} from "@/lib/us-records/uspto-ptab";
import {
  searchNcDocInmate,
  shouldSearchNcDoc,
} from "@/lib/us-records/nc-doc";
import {
  searchIlDocInmate,
  shouldSearchIlDoc,
} from "@/lib/us-records/il-doc";
import {
  searchUsmsWanted,
  shouldSearchUsmsWanted,
} from "@/lib/us-records/usms-wanted";
import { searchOkOscn, shouldSearchOkOscn } from "@/lib/us-records/ok-oscn";
import {
  searchInMycase,
  shouldSearchInMycase,
} from "@/lib/us-records/in-mycase";
import { searchWiCcap, shouldSearchWiCcap } from "@/lib/us-records/wi-ccap";
import { searchPaUjs, shouldSearchPaUjs } from "@/lib/us-records/pa-ujs";
import { searchFlFdle, shouldSearchFlFdle } from "@/lib/us-records/fl-fdle";
import { searchOpenFec } from "@/lib/us-records/openfec";
import {
  hasOpenSanctionsKey,
  searchOpenSanctions,
} from "@/lib/us-records/opensanctions";
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

  return Boolean(
    parsed.county || parsed.city || parsed.zip || parsed.state === "VA",
  );
}

function wantsFlFdle(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  return shouldSearchFlFdle(parsed);
}

function wantsNsopw(parsed: ReturnType<typeof parseUsRecordsQuery>): boolean {
  if (parsed.country && parsed.country !== "US") return false;

  return Boolean(parsed.firstName && parsed.lastName);
}

function wantsUsFederal(
  parsed: ReturnType<typeof parseUsRecordsQuery>,
): boolean {
  return !parsed.country || parsed.country === "US";
}

function wantsPriorityStatePortals(
  parsed: ReturnType<typeof parseUsRecordsQuery>,
): boolean {
  if (parsed.country && parsed.country !== "US") return false;

  return (
    !parsed.state ||
    [
      "MD",
      "FL",
      "TX",
      "NY",
      "DE",
      "VA",
      "OK",
      "PA",
      "IN",
      "WA",
      "NC",
      "WI",
    ].includes(parsed.state)
  );
}

function buildPortalLayer(
  parsed: ReturnType<typeof parseUsRecordsQuery>,
): PublicPortalHit[] {
  const portals: PublicPortalHit[] = [];

  if (!parsed.country || parsed.country === "US") {
    if (parsed.state) {
      portals.push(...buildStateCourtPortals(parsed));
      if (parsed.mode === "person")
        portals.push(...buildStateSorPortals(parsed));
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
    message: count === 0 ? errors[0]?.message || emptyMessage : undefined,
  };
}

export async function searchUsCourt(
  query: string,
): Promise<UsCourtSearchResult> {
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
      settleSource("un-sanctions", "UN Sanctions", () =>
        searchUnSanctions(parsed, 8),
      ),
      settleSource("eu-sanctions", "EU Sanctions", () =>
        searchEuSanctions(parsed, 8),
      ),
      settleSource("uk-sanctions", "UK OFSI Sanctions", () =>
        searchUkSanctions(parsed, 8),
      ),
      settleSource("ca-sanctions", "Canada SEMA Sanctions", () =>
        searchCaSanctions(parsed, 8),
      ),
      settleSource("au-dfat", "Australia DFAT Sanctions", () =>
        searchAuDfat(parsed, 8),
      ),
      settleSource("ch-seco", "Switzerland SECO Sanctions", () =>
        searchChSeco(parsed, 8),
      ),
      settleSource("worldbank-debarred", "World Bank Debarment", () =>
        searchWorldBankDebarred(parsed, 6),
      ),
      settleSource("fbi-wanted", "FBI Wanted", () =>
        searchFbiWanted(parsed, 8),
      ),
      settleSource("sam-gov", "SAM.gov Exclusions", () =>
        searchSamExclusions(parsed, 6),
      ),
      settleSource("sec-edgar", "SEC EDGAR", () => searchSecEdgar(parsed, 6)),
      settleSource("usaspending", "USASpending.gov", () =>
        searchUsaSpending(parsed, 6),
      ),
      settleSource("irs-eo", "IRS EO (ProPublica)", () =>
        searchIrsEoNonprofit(parsed, 6),
      ),
    );
  } else {
    jobs.push(
      settleSource("ofac", "OFAC SDN", () => searchOfacSdn(parsed, 8)),
      settleSource("un-sanctions", "UN Sanctions", () =>
        searchUnSanctions(parsed, 8),
      ),
      settleSource("eu-sanctions", "EU Sanctions", () =>
        searchEuSanctions(parsed, 8),
      ),
      settleSource("uk-sanctions", "UK OFSI Sanctions", () =>
        searchUkSanctions(parsed, 8),
      ),
      settleSource("ca-sanctions", "Canada SEMA Sanctions", () =>
        searchCaSanctions(parsed, 8),
      ),
      settleSource("au-dfat", "Australia DFAT Sanctions", () =>
        searchAuDfat(parsed, 8),
      ),
      settleSource("ch-seco", "Switzerland SECO Sanctions", () =>
        searchChSeco(parsed, 8),
      ),
      settleSource("worldbank-debarred", "World Bank Debarment", () =>
        searchWorldBankDebarred(parsed, 6),
      ),
    );
  }

  if (
    parsed.country === "NO" ||
    /\b(norway|norsk|brreg|oslo)\b/i.test(parsed.raw)
  ) {
    jobs.push(
      settleSource("no-brreg", "Norway Brønnøysund", () =>
        searchNoBrreg(parsed, 8),
      ),
    );
  }

  if (shouldSearchBop(parsed)) {
    jobs.push(
      settleSource("bop-inmate", "BOP Inmate Locator", () =>
        searchBopInmateLocator(parsed, 8),
      ),
    );
  }

  if (shouldSearchTxTdcj(parsed)) {
    jobs.push(
      settleSource("tx-tdcj", "Texas TDCJ Inmate Search", () =>
        searchTxTdcj(parsed, 8),
      ),
    );
  }

  if (shouldSearchNcDoc(parsed)) {
    jobs.push(
      settleSource("nc-doc", "NC DPS Offender Search", () =>
        searchNcDocInmate(parsed, 8),
      ),
    );
  }

  if (shouldSearchIlDoc(parsed)) {
    jobs.push(
      settleSource("il-doc", "Illinois DOC Inmate Search", () =>
        searchIlDocInmate(parsed, 8),
      ),
    );
  }

  if (shouldSearchFlSunbiz(parsed)) {
    jobs.push(
      settleSource("fl-sunbiz", "Florida Sunbiz", () =>
        searchFlSunbiz(parsed, 8),
      ),
    );
  }

  if (shouldSearchNycProperty(parsed)) {
    jobs.push(
      settleSource("nyc-pluto", "NYC PLUTO Property", () =>
        searchNycPluto(parsed, 6),
      ),
      settleSource("nyc-acris", "NYC ACRIS", () => searchNycAcris(parsed, 6)),
    );
  }

  if (shouldSearchPhillyOpa(parsed)) {
    jobs.push(
      settleSource("philly-opa", "Philadelphia OPA", () =>
        searchPhillyOpa(parsed, 6),
      ),
    );
  }

  if (shouldSearchKaneIlProperty(parsed)) {
    jobs.push(
      settleSource("kane-il-property", "Kane County IL Assessor", () =>
        searchKaneIlProperty(parsed, 6),
      ),
    );
  }

  if (shouldSearchNysDos(parsed)) {
    jobs.push(
      settleSource("nys-dos", "NY DOS Corporations", () =>
        searchNysDos(parsed, 6),
      ),
    );
  }

  if (shouldSearchWaDoh(parsed)) {
    jobs.push(
      settleSource("wa-doh-license", "WA DOH Credentials", () =>
        searchWaDohLicense(parsed, 8),
      ),
    );
  }

  if (shouldSearchCalBar(parsed)) {
    jobs.push(
      settleSource("calbar-license", "State Bar of California", () =>
        searchCalBarLicense(parsed, 8),
      ),
    );
  }

  if (shouldSearchTxTdlr(parsed)) {
    jobs.push(
      settleSource("tx-tdlr", "Texas TDLR", () =>
        searchTxTdlrLicense(parsed, 8),
      ),
    );
  }

  if (shouldSearchFaaAircraft(parsed)) {
    jobs.push(
      settleSource("faa-aircraft", "FAA Aircraft Registry", () =>
        searchFaaAircraft(parsed, 6),
      ),
    );
  }

  if (shouldSearchFccUls(parsed)) {
    jobs.push(
      settleSource("fcc-uls", "FCC ULS Licenses", () =>
        searchFccUls(parsed, 6),
      ),
    );
  }

  if (shouldSearchUsptoPtab(parsed)) {
    jobs.push(
      settleSource("uspto-ptab", "USPTO PTAB Decisions", () =>
        searchUsptoPtab(parsed, 6),
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

  if (shouldSearchDeaFugitives(parsed)) {
    jobs.push(
      settleSource("dea-fugitives", "DEA Fugitives", () =>
        searchDeaFugitives(parsed, 8),
      ),
    );
  }

  if (shouldSearchUsmsWanted(parsed)) {
    jobs.push(
      settleSource("usms-wanted", "US Marshals Most Wanted", () =>
        searchUsmsWanted(parsed, 8),
      ),
    );
  }

  jobs.push(
    settleSource("interpol", "Interpol Red Notices", () =>
      searchInterpolRedNotices(parsed, 8),
    ),
    settleSource("eu-most-wanted", "Europe's Most Wanted", () =>
      searchEuMostWanted(parsed, 8),
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
      settleSource("nsopw", "NSOPW National SOR", () =>
        searchNsopw(parsed, 12),
      ),
    );
  }

  if (shouldSearchCaRcmpSor(parsed)) {
    jobs.push(
      settleSource("ca-rcmp-sor", "RCMP High Risk Child SOR", () =>
        searchCaRcmpSor(parsed, 10),
      ),
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
        settleSource("va-ocis", "Virginia OCIS", () =>
          searchVaOcis(parsed, 10),
        ),
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
        settleSource("ok-oscn", "Oklahoma OSCN", () =>
          searchOkOscn(parsed, 10),
        ),
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

export async function searchUsNpd(
  query: string,
): Promise<UsIdentitySearchResult> {
  return searchUsIdentity(query, { includeCourt: true });
}

export async function searchUsVaSor(
  query: string,
): Promise<UsVaSorSearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  // Virginia-focused: VA SOR + NSOPW scoped to VA (and FL FDLE only if FL cues present)
  const jobs = [
    settleSource("nsopw", "NSOPW National SOR", () =>
      searchNsopw(
        parsed.state ? parsed : { ...parsed, state: "VA", country: "US" },
        25,
      ),
    ),
    settleSource("va-sor", "Virginia Sex Offender Registry", () =>
      searchVaSexOffenderRegistry(parsed, 25),
    ),
  ];

  if (wantsFlFdle(parsed)) {
    jobs.push(
      settleSource("fl-fdle", "Florida FDLE SOR", () =>
        searchFlFdle(parsed, 25),
      ),
    );
  }

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

/** National NSOPW (+ live state SOR twins when query cues match). */
export async function searchNationalSor(
  query: string,
): Promise<UsVaSorSearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const jobs = [];

  if (!parsed.country || parsed.country === "US") {
    jobs.push(
      settleSource("nsopw", "NSOPW National SOR", () =>
        searchNsopw(parsed, 40),
      ),
    );
  }
  // Always fan out to Canada high-risk SOR on this module (tiny public set).
  if (!parsed.country || parsed.country === "US" || parsed.country === "CA") {
    jobs.push(
      settleSource("ca-rcmp-sor", "RCMP High Risk Child SOR", () =>
        searchCaRcmpSor(parsed, 20),
      ),
    );
  }
  if (
    (!parsed.country || parsed.country === "US") &&
    (!parsed.state || parsed.state === "VA") &&
    (parsed.county || parsed.city || parsed.zip)
  ) {
    jobs.push(
      settleSource("va-sor", "Virginia Sex Offender Registry", () =>
        searchVaSexOffenderRegistry(parsed, 20),
      ),
    );
  }
  if ((!parsed.country || parsed.country === "US") && wantsFlFdle(parsed)) {
    jobs.push(
      settleSource("fl-fdle", "Florida FDLE SOR", () =>
        searchFlFdle(parsed, 20),
      ),
    );
  }

  if (!jobs.length) {
    return {
      query: trimmed,
      parsed,
      count: 0,
      people: [],
      sources: [],
      errors: [],
      message:
        "No applicable sex offender registries for this country. Try US (NSOPW) or Canada.",
    };
  }

  const settled = await Promise.all(jobs);
  const people = settled.flatMap((part) => (part.value as PersonHit[]) ?? []);
  // Dedupe by name+state+source
  const seen = new Set<string>();
  const deduped = people.filter((row) => {
    const key = `${row.name.toUpperCase()}|${row.state || ""}|${row.country || ""}|${row.source.id}`;

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
  const errors = collectErrors(settled);
  const sources = uniqueSources(deduped.map((row) => row.source.label));

  return {
    query: trimmed,
    parsed,
    count: deduped.length,
    people: deduped,
    sources,
    errors,
    message:
      deduped.length === 0
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
    settleSource("un-sanctions", "UN Sanctions", () =>
      searchUnSanctions(parsed, 12),
    ),
    settleSource("eu-sanctions", "EU Sanctions", () =>
      searchEuSanctions(parsed, 12),
    ),
    settleSource("uk-sanctions", "UK OFSI Sanctions", () =>
      searchUkSanctions(parsed, 12),
    ),
    settleSource("ca-sanctions", "Canada SEMA Sanctions", () =>
      searchCaSanctions(parsed, 12),
    ),
    settleSource("au-dfat", "Australia DFAT Sanctions", () =>
      searchAuDfat(parsed, 12),
    ),
    settleSource("ch-seco", "Switzerland SECO Sanctions", () =>
      searchChSeco(parsed, 12),
    ),
    settleSource("worldbank-debarred", "World Bank Debarment", () =>
      searchWorldBankDebarred(parsed, 10),
    ),
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
      settleSource("sam-gov", "SAM.gov Exclusions", () =>
        searchSamExclusions(parsed, 8),
      ),
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

export async function searchWantedPersons(
  query: string,
): Promise<UsIdentitySearchResult> {
  const trimmed = assertUsQuery(query);
  const parsed = parseUsRecordsQuery(trimmed);

  const settled = await Promise.all([
    settleSource("fbi-wanted", "FBI Wanted", () => searchFbiWanted(parsed, 12)),
    settleSource("interpol", "Interpol Red Notices", () =>
      searchInterpolRedNotices(parsed, 12),
    ),
    settleSource("eu-most-wanted", "Europe's Most Wanted", () =>
      searchEuMostWanted(parsed, 12),
    ),
    settleSource("dallas-wanted", "Dallas County Wanted", () =>
      searchDallasWanted(parsed, 12),
    ),
    settleSource("dea-fugitives", "DEA Fugitives", () =>
      searchDeaFugitives(parsed, 12),
    ),
    settleSource("usms-wanted", "US Marshals Most Wanted", () =>
      searchUsmsWanted(parsed, 12),
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
