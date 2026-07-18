import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  countStealerLogRows,
  extractStealerLogEntries,
  normalizeDomain,
  type DomainSearchResult,
} from "@/lib/domain-search";
import { fetchCombinedDomainOsint } from "@/lib/osint-combined";
import { searchProxynovaCombForDomain } from "@/lib/proxynova-comb";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "domains");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const domain = normalizeDomain(query);

  if (!domain) {
    return NextResponse.json(
      { error: "Enter a valid domain name (e.g. example.com)." },
      { status: 400 },
    );
  }

  const start = Number(req.nextUrl.searchParams.get("start") ?? 0);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  const [combinedStealer, breachedResult] = await Promise.allSettled([
    fetchCombinedDomainOsint(domain),
    searchProxynovaCombForDomain(domain, { start, limit }),
  ]);

  const stealerLogs: DomainSearchResult["stealerLogs"] = {
    source: "Stealer Logs",
    data: null,
  };
  let indexSearch: DomainSearchResult["indexSearch"] = null;

  if (combinedStealer.status === "fulfilled") {
    const { osintcat, godseye } = combinedStealer.value;

    if (osintcat) {
      stealerLogs.data = osintcat;
    }

    if (godseye && godseye.count > 0) {
      indexSearch = {
        count: godseye.count,
        results: godseye.results,
      };
    }

    if (!osintcat && !godseye?.count) {
      stealerLogs.error = "Stealer log lookup failed";
    }
  } else {
    stealerLogs.error =
      combinedStealer.reason instanceof Error
        ? combinedStealer.reason.message
        : "Stealer log lookup failed";
  }

  let breachedData: DomainSearchResult["breachedData"] = null;
  let breachedDataError: string | undefined;

  if (breachedResult.status === "fulfilled") {
    breachedData = breachedResult.value;
  } else {
    breachedDataError =
      breachedResult.reason instanceof Error
        ? breachedResult.reason.message
        : "Breached data lookup failed";
  }

  const stealerHits =
    countStealerLogRows(stealerLogs.data) +
    extractStealerLogEntries(
      indexSearch ? { results: indexSearch.results } : null,
    ).length;
  const breachHits = breachedData?.returned ?? 0;
  const hasResults = stealerHits > 0 || breachHits > 0;

  const result: DomainSearchResult = {
    query,
    domain,
    stealerLogs,
    indexSearch,
    breachedData,
    breachedDataError,
    hasResults,
  };

  if (!hasResults) {
    return NextResponse.json({
      ...result,
      message: "No stealer logs or breached data found for this domain.",
    });
  }

  return NextResponse.json(result);
}
