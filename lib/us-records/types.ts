export type PublicRecordsSourceId =
  | "courtlistener"
  | "openfec"
  | "nppes"
  | "ofac"
  | "va-sor"
  | "va-ocis"
  | "de-courtconnect"
  | "ok-oscn"
  | "fl-hover"
  | "dallas-wanted"
  | "in-mycase"
  | "wi-ccap"
  | "pa-ujs"
  | "fl-fdle"
  | "eu-sanctions"
  | "uk-sanctions"
  | "ca-sanctions"
  | "au-dfat"
  | "ch-seco"
  | "no-brreg"
  | "sec-edgar"
  | "eu-most-wanted"
  | "worldbank-debarred"
  | "tx-tdcj"
  | "fl-sunbiz"
  | "nyc-pluto"
  | "nyc-acris"
  | "philly-opa"
  | "kane-il-property"
  | "nys-dos"
  | "irs-eo"
  | "usaspending"
  | "fbi-wanted"
  | "interpol"
  | "opensanctions"
  | "un-sanctions"
  | "nsopw"
  | "ca-rcmp-sor"
  | "sam-gov"
  | "bop-inmate"
  | "state-portal"
  | "country-portal";

/** @deprecated Use PublicRecordsSourceId */
export type UsRecordsSourceId = PublicRecordsSourceId;

export type SourceMeta = {
  id: PublicRecordsSourceId;
  label: string;
  jurisdiction?: string;
  retrievedAt: string;
  deepLink?: string;
  confidence: "high" | "medium" | "low";
};

export type SourceError = {
  id: PublicRecordsSourceId;
  label: string;
  message: string;
};

export type CourtCaseHit = {
  id: string;
  caseName: string;
  docketNumber?: string;
  court?: string;
  dateFiled?: string;
  natureOfSuit?: string;
  snippet?: string;
  parties?: string[];
  source: SourceMeta;
};

export type PersonHit = {
  id: string;
  name: string;
  kind:
    | "candidate"
    | "provider"
    | "sanctions"
    | "sex-offender"
    | "wanted"
    | "inmate"
    | "business"
    | "property"
    | "other";
  subtitle?: string;
  state?: string;
  country?: string;
  details: Array<{ label: string; value: string }>;
  source: SourceMeta;
};

export type PublicPortalHit = {
  id: string;
  title: string;
  summary: string;
  source: SourceMeta;
};

export type PublicRecordsSearchResult = {
  query: string;
  parsed: ParsedPublicQuery;
  count: number;
  people: PersonHit[];
  cases: CourtCaseHit[];
  portals: PublicPortalHit[];
  sources: string[];
  errors: SourceError[];
  message?: string;
};

export type UsCourtSearchResult = PublicRecordsSearchResult;
export type UsIdentitySearchResult = PublicRecordsSearchResult;
export type UsVaSorSearchResult = Pick<
  PublicRecordsSearchResult,
  "query" | "parsed" | "count" | "people" | "sources" | "errors" | "message"
>;

export type ParsedPublicQuery = {
  raw: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  country?: string;
  county?: string;
  city?: string;
  zip?: string;
  dob?: string;
  caseNumber?: string;
  mode: "person" | "case" | "entity" | "raw";
};

/** @deprecated Use ParsedPublicQuery */
export type ParsedUsQuery = ParsedPublicQuery;
