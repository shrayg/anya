export type UsRecordsSourceId =
  | "courtlistener"
  | "openfec"
  | "nppes"
  | "ofac";

export type SourceMeta = {
  id: UsRecordsSourceId;
  label: string;
  jurisdiction?: string;
  retrievedAt: string;
  deepLink?: string;
  confidence: "high" | "medium" | "low";
};

export type SourceError = {
  id: UsRecordsSourceId;
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
  kind: "candidate" | "provider" | "sanctions" | "other";
  subtitle?: string;
  state?: string;
  details: Array<{ label: string; value: string }>;
  source: SourceMeta;
};

export type UsCourtSearchResult = {
  query: string;
  parsed: ParsedUsQuery;
  count: number;
  cases: CourtCaseHit[];
  sources: string[];
  errors: SourceError[];
  message?: string;
};

export type UsIdentitySearchResult = {
  query: string;
  parsed: ParsedUsQuery;
  count: number;
  people: PersonHit[];
  cases: CourtCaseHit[];
  sources: string[];
  errors: SourceError[];
  message?: string;
};

export type ParsedUsQuery = {
  raw: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  dob?: string;
  caseNumber?: string;
  mode: "person" | "case" | "raw";
};
