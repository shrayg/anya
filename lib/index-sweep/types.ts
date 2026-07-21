export type IndexSweepQueryKind = "email" | "phone";

export type IndexSweepEngine = "google" | "bing" | "duckduckgo";

/** Exact = quoted identifier. Loose = unquoted lead (never high unless corroborated). */
export type IndexSweepMatchMode = "exact" | "loose";

export type IndexSweepConfidence = "high" | "medium" | "low";

export type IndexSweepDork = {
  platformId: string;
  platformLabel: string;
  site: string;
  /** Platform baseline usefulness for this surface. */
  platformReliability: IndexSweepConfidence;
  /** Display confidence after match-mode + corroboration rules. */
  confidence: IndexSweepConfidence;
  matchMode: IndexSweepMatchMode;
  corroborated: boolean;
  note: string;
  /** Exact operator query (no engine URL). */
  query: string;
  /** Identifier variant used. */
  identifier: string;
  engines: Array<{
    engine: IndexSweepEngine;
    label: string;
    url: string;
  }>;
};

export type IndexSweepHit = {
  platformLabel: string;
  site: string;
  title: string;
  url: string;
  snippet: string | null;
  engine: IndexSweepEngine;
  matchMode: IndexSweepMatchMode;
  confidence: IndexSweepConfidence;
  corroborated: boolean;
};

export type IndexSweepLocationFinding = {
  url: string;
  domain: string;
  title: string | null;
  addresses: string[];
  phones: string[];
  snippet: string | null;
  proximity: "snippet" | "page-near-identifier" | "page";
  confidence: IndexSweepConfidence;
};

export type IndexSweepSearchResult = {
  query: string;
  kind: IndexSweepQueryKind;
  normalized: string;
  variants: string[];
  dorks: IndexSweepDork[];
  /** Live hits when a soft HTML search succeeded (best-effort). */
  hits: IndexSweepHit[];
  /**
   * Location / contact blocks scraped from SERP pages that mention the
   * identifier (Contact Us / FAQ style pages).
   */
  locations: IndexSweepLocationFinding[];
  /** Multi-method LinkedIn resolution (SERP + GitHub pivots). */
  linkedInResolve: {
    hits: Array<{
      profileUrl: string;
      publicIdentifier: string;
      title: string | null;
      snippet: string | null;
      method: string;
      confidence: IndexSweepConfidence;
      evidence: string[];
    }>;
    pivots: Array<{
      platform: string;
      url: string;
      label: string;
      confidence: IndexSweepConfidence;
      evidence: string[];
    }>;
    methodsTried: string[];
    warning?: string;
  } | null;
  unsupportedNote: string;
  sources: Array<{
    id: "index-sweep";
    label: string;
    checked: number;
    count: number;
    errors: number;
    durationMs: number;
    found: Array<{
      siteName: string;
      domain: string;
      exists: boolean;
      rateLimit: boolean;
      emailrecovery: string | null;
      phoneNumber: string | null;
      profileUrl: string | null;
      others: Record<string, string> | null;
    }>;
    warning?: string;
  }>;
  durationMs: number;
  warning?: string;
};
