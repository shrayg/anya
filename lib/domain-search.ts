import type { CombSearchResult } from "@/lib/proxynova-comb";

export type DomainSearchResult = {
  query: string;
  domain: string;
  stealerLogs: {
    source: string;
    data: Record<string, unknown> | null;
    error?: string;
  };
  godseyeSearch?: {
    source?: string;
    count: number;
    results: unknown[];
  } | null;
  breachedData: CombSearchResult | null;
  breachedDataError?: string;
  hasResults: boolean;
};

export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return null;
  }

  return value;
}

export function countStealerLogRows(data: Record<string, unknown> | null): number {
  if (!data) return 0;

  const breachData = data.breach_data ?? data.results ?? data.data;

  if (Array.isArray(breachData)) return breachData.length;

  return 0;
}

export function extractStealerLogEntries(
  data: Record<string, unknown> | null,
): unknown[] {
  if (!data) return [];

  const breachData = data.breach_data ?? data.results ?? data.data;

  return Array.isArray(breachData) ? breachData : [];
}
