import type { GodsEyeResponse } from "@/lib/godseye";
import {
  extractGodsEyeResults,
  fetchGodsEyeSearchSafe,
} from "@/lib/godseye";
import type { DiscordProfile } from "@/lib/discord-profile";
import { sanitizePublicText } from "@/lib/public-branding";

export type FivemSection = {
  kind: "accounts" | "bans";
  records: unknown[];
  raw: GodsEyeResponse | null;
  error?: string;
  code?: string;
};

export type FivemSearchResult = {
  discordId: string;
  accounts: FivemSection;
  bans: FivemSection;
  profile: DiscordProfile | null;
  hasResults: boolean;
  message?: string;
  warning?: string;
};

function isBanRecord(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;

  const record = entry as Record<string, unknown>;
  const haystack = JSON.stringify(record).toLowerCase();

  return (
    haystack.includes("ban") ||
    haystack.includes("blacklist") ||
    haystack.includes("punishment")
  );
}

function splitFivemRecords(records: unknown[]) {
  const bans: unknown[] = [];
  const accounts: unknown[] = [];

  for (const entry of records) {
    if (isBanRecord(entry)) {
      bans.push(entry);
    } else {
      accounts.push(entry);
    }
  }

  return { accounts, bans };
}

export async function fetchFivemIntel(
  discordId: string,
): Promise<{
  searchData: GodsEyeResponse | null;
  records: unknown[];
  warning?: string;
}> {
  const searchData = await fetchGodsEyeSearchSafe("fivem", discordId);

  if (!searchData) {
    return { searchData: null, records: [] };
  }

  const errorText = String(searchData.error || searchData.message || "");
  const records = extractGodsEyeResults(searchData);

  if (records.length > 0) {
    return { searchData, records };
  }

  if (errorText) {
    return {
      searchData,
      records: [],
      warning: sanitizePublicText(errorText),
    };
  }

  return { searchData, records: [] };
}

export function buildFivemSearchResult(input: {
  discordId: string;
  searchData: GodsEyeResponse | null;
  records: unknown[];
  profile: DiscordProfile | null;
  warning?: string;
}): FivemSearchResult {
  const { accounts, bans } = splitFivemRecords(input.records);

  const response: FivemSearchResult = {
    discordId: input.discordId,
    accounts: {
      kind: "accounts",
      records: accounts,
      raw: input.searchData,
      error: input.warning,
    },
    bans: {
      kind: "bans",
      records: bans,
      raw: input.searchData,
    },
    profile: input.profile,
    hasResults: false,
    warning: input.warning,
  };

  response.hasResults = fivemHasResults(response);

  if (!response.hasResults) {
    response.message = fivemErrorMessage(response) ?? undefined;
  }

  return response;
}

export function fivemHasResults(result: FivemSearchResult): boolean {
  return (
    result.accounts.records.length > 0 ||
    result.bans.records.length > 0 ||
    Boolean(result.profile)
  );
}

export function fivemErrorMessage(result: FivemSearchResult): string | null {
  if (fivemHasResults(result)) return null;

  const errors = [result.accounts.error, result.bans.error]
    .filter(Boolean)
    .map((entry) => sanitizePublicText(String(entry)));

  if (errors.length > 0) {
    return errors[0] ?? "FiveM lookup failed.";
  }

  return (
    sanitizePublicText(result.message ?? "") ||
    "No FiveM accounts or bans found for this Discord ID."
  );
}

// Legacy helpers kept for typed sections when dedicated FiveM API is used.
export function extractFivemRecords(data: GodsEyeResponse | null): unknown[] {
  return extractGodsEyeResults(data);
}

export function buildFivemSection(
  kind: "accounts" | "bans",
  result: {
    ok: boolean;
    data: GodsEyeResponse | null;
    error?: string;
    code?: string;
  },
): FivemSection {
  return {
    kind,
    records: result.ok ? extractFivemRecords(result.data) : [],
    raw: result.data,
    error: result.error ? sanitizePublicText(result.error) : undefined,
    code: result.code,
  };
}
