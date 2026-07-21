export type HandleSweepErrorType = "status_code" | "message" | "response_url";

export type HandleSweepSite = {
  name: string;
  url: string;
  urlMain?: string;
  errorType: HandleSweepErrorType;
  errorMsg?: string | string[];
  errorUrl?: string;
  errorCode?: number;
  regexCheck?: string;
};

export type HandleSweepHit = {
  siteName: string;
  username: string;
  url: string;
  statusCode: number;
  found: boolean;
  responseMs: number | null;
  error?: string;
  skipped?: boolean;
};

export type HandleSweepSearchResult = {
  query: string;
  username: string;
  count: number;
  checked: number;
  skipped: number;
  found: HandleSweepHit[];
  notFound: number;
  errors: number;
  durationMs: number;
  warning?: string;
};
