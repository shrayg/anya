import type { HandleSweepSearchResult } from "@/lib/handle-sweep/types";
import type { UsernameAccountsSearchResult } from "@/lib/username-accounts/types";

/** Anya-facing source ids — never show upstream tool names in UI. */
export type AccountPresenceSourceId = "web-profiles" | "handle-sweep";

export type AccountPresenceHit = {
  siteName: string;
  url: string;
  statusCode: number;
  category?: string;
  responseMs: number | null;
};

export type AccountPresenceSourceBlock = {
  id: AccountPresenceSourceId;
  label: string;
  checked: number;
  count: number;
  errors: number;
  durationMs: number;
  found: AccountPresenceHit[];
  warning?: string;
};

export type AccountPresenceSearchResult = {
  query: string;
  username: string;
  count: number;
  checked: number;
  sources: AccountPresenceSourceBlock[];
  durationMs: number;
  warning?: string;
};

export const WEB_PROFILES_SOURCE_ID = "web-profiles" as const;
export const WEB_PROFILES_SOURCE_LABEL = "Web Profiles";
export const HANDLE_SWEEP_SOURCE_LABEL = "Handle Sweep";

export function mapWebProfilesSource(
  result: UsernameAccountsSearchResult,
): AccountPresenceSourceBlock {
  return {
    id: WEB_PROFILES_SOURCE_ID,
    label: WEB_PROFILES_SOURCE_LABEL,
    checked: result.checked,
    count: result.count,
    errors: result.errors,
    durationMs: result.durationMs,
    warning: result.warning,
    found: result.found.map((hit) => ({
      siteName: hit.siteName,
      url: hit.url,
      statusCode: hit.statusCode,
      category: hit.category,
      responseMs: hit.responseMs,
    })),
  };
}

export function mapHandleSweepSource(
  result: HandleSweepSearchResult,
): AccountPresenceSourceBlock {
  return {
    id: "handle-sweep",
    label: HANDLE_SWEEP_SOURCE_LABEL,
    checked: result.checked,
    count: result.count,
    errors: result.errors,
    durationMs: result.durationMs,
    warning: result.warning,
    found: result.found.map((hit) => ({
      siteName: hit.siteName,
      url: hit.url,
      statusCode: hit.statusCode,
      responseMs: hit.responseMs,
    })),
  };
}
