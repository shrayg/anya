import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  breachHubRowsToCredentials,
  fetchBreachHubAdditiveBreachSearch,
} from "@/lib/breachhub";
import { searchBreachVipForEmail } from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  detectCsintSearchType,
  fetchCsintAdditiveBreachSearch,
} from "@/lib/csint";
import {
  fetchGodsEyeEmailReport,
  fetchGodsEyeSearchResult,
  resolveGodsEyeSearchType,
} from "@/lib/godseye";
import {
  fetchOsintCatBreach,
  getOsintCatApiKey,
  sanitizeBreachResponse,
} from "@/lib/osintcat";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import {
  normalizeEmail,
  searchProxynovaCombForEmail,
  type CombCredential,
  type CombSearchResult,
} from "@/lib/proxynova-comb";

/** Keep high ceilings — do not reintroduce 50/100 result caps on paid indexes. */
const BREACH_FANOUT_MAX_ROWS = 100_000;
const COMBINED_GODSEYE_TIMEOUT_MS = 18_000;
const COMBINED_CSINT_TIMEOUT_MS = 22_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 36_000;

function mergeCredentials(
  primary: CombCredential[],
  secondary: CombCredential[],
): CombCredential[] {
  const seen = new Set<string>();
  const merged: CombCredential[] = [];

  for (const row of [...primary, ...secondary]) {
    const key = `${row.identifier.toLowerCase()}\0${row.secret}`;

    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

async function fetchOsintCatBreachSafe(email: string) {
  if (!getOsintCatApiKey()?.trim()) return null;

  try {
    return sanitizeBreachResponse(await fetchOsintCatBreach(email));
  } catch {
    return null;
  }
}

async function fetchGodsEyeSearchSafe(query: string, typeHint?: string) {
  try {
    const type = resolveGodsEyeSearchType(query, typeHint);

    return await fetchGodsEyeSearchResult(
      type,
      query,
      COMBINED_GODSEYE_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

function emptyComb(query: string, start: number): CombSearchResult {
  return {
    query,
    totalMatches: 0,
    returned: 0,
    start,
    credentials: [],
    source: "Breached Data",
  };
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breaches");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json(
      {
        error:
          "Enter an email, username, or search term (at least 2 characters).",
      },
      { status: 400 },
    );
  }

  const email = normalizeEmail(query);
  const start = Number(req.nextUrl.searchParams.get("start") ?? 0);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  try {
    if (email) {
      // CSINT additive already includes BreachBase + Snusbase when CSINT is on.
      // BreachHub fan-out skips those (and OsintCat/BreachVIP/CordCat) via
      // lib/provider-dedupe when the direct primary is configured.
      const [
        combSettled,
        godseyeReportSettled,
        godseyeSearchSettled,
        breachVipSettled,
        csintSettled,
        breachHubSettled,
        osintCatSettled,
      ] = await withDeadline(
        Promise.allSettled([
          searchProxynovaCombForEmail(email, {
            start,
            limit: Math.min(Math.max(1, limit), 100),
          }),
          fetchGodsEyeEmailReport(email),
          fetchGodsEyeSearchSafe(email, "email"),
          searchBreachVipForEmail(email, { maxRows: BREACH_FANOUT_MAX_ROWS }),
          fetchCsintAdditiveBreachSearch(
            email,
            "email",
            COMBINED_CSINT_TIMEOUT_MS,
          ),
          fetchBreachHubAdditiveBreachSearch(
            email,
            "email",
            COMBINED_BREACHHUB_TIMEOUT_MS,
          ),
          fetchOsintCatBreachSafe(email),
        ]),
        OSINT_ROUTE_DEADLINE_MS,
      );

      const combResult = settledValue(combSettled) ?? emptyComb(email, start);
      const godseyeReport = settledValue(godseyeReportSettled);
      const godseyeSearch = settledValue(godseyeSearchSettled);
      const breachVip = settledValue(breachVipSettled);
      const csint = settledValue(csintSettled);
      const breachHub = settledValue(breachHubSettled);
      const osintCat = settledValue(osintCatSettled);

      const mergedCredentials = [
        combResult.credentials,
        breachVip?.credentials ?? [],
        godseyeSearch ? breachHubRowsToCredentials(godseyeSearch.results) : [],
        csint ? csintRowsToCredentials(csint.results) : [],
        breachHub ? breachHubRowsToCredentials(breachHub.results) : [],
        osintCat ? breachHubRowsToCredentials(osintCat.results) : [],
      ].reduce(
        (acc, next) => mergeCredentials(acc, next),
        [] as CombCredential[],
      );

      const extras =
        (breachVip?.totalMatches ?? 0) +
        (godseyeSearch?.count ?? 0) +
        (csint?.count ?? 0) +
        (breachHub?.count ?? 0) +
        (osintCat?.count ?? 0);

      const response = {
        ...combResult,
        totalMatches: combResult.totalMatches + extras,
        returned: mergedCredentials.length,
        credentials: mergedCredentials,
        godseyeReport,
        hasGodsEyeReport: Boolean(godseyeReport),
        hasBreachVipResults: Boolean(breachVip && breachVip.returned > 0),
        breachVipCount: breachVip?.totalMatches ?? 0,
        csintCount: csint?.count ?? 0,
        breachHubCount: breachHub?.count ?? 0,
        osintCatCount: osintCat?.count ?? 0,
        godseyeSearchCount: godseyeSearch?.count ?? 0,
      };

      if (
        response.returned === 0 &&
        !godseyeReport &&
        !response.hasBreachVipResults &&
        !response.csintCount &&
        !response.breachHubCount &&
        !response.osintCatCount &&
        !response.godseyeSearchCount
      ) {
        return NextResponse.json({
          ...response,
          message: "No results were found.",
        });
      }

      return NextResponse.json(response);
    }

    // Username / free-text — former Breach Index module + full breach fan-out.
    const csintType = detectCsintSearchType(query);
    const [csintSettled, breachHubSettled, godseyeSearchSettled] =
      await withDeadline(
        Promise.allSettled([
          fetchCsintAdditiveBreachSearch(
            query,
            csintType,
            COMBINED_CSINT_TIMEOUT_MS,
          ),
          fetchBreachHubAdditiveBreachSearch(
            query,
            csintType,
            COMBINED_BREACHHUB_TIMEOUT_MS,
          ),
          fetchGodsEyeSearchSafe(query),
        ]),
        OSINT_ROUTE_DEADLINE_MS,
      );

    const csint = settledValue(csintSettled);
    const breachHub = settledValue(breachHubSettled);
    const godseyeSearch = settledValue(godseyeSearchSettled);

    const mergedCredentials = [
      csint ? csintRowsToCredentials(csint.results) : [],
      breachHub ? breachHubRowsToCredentials(breachHub.results) : [],
      godseyeSearch ? breachHubRowsToCredentials(godseyeSearch.results) : [],
    ].reduce(
      (acc, next) => mergeCredentials(acc, next),
      [] as CombCredential[],
    );

    const extras =
      (csint?.count ?? 0) +
      (breachHub?.count ?? 0) +
      (godseyeSearch?.count ?? 0);

    const response = {
      ...emptyComb(query, start),
      totalMatches: extras,
      returned: mergedCredentials.length,
      credentials: mergedCredentials,
      hasGodsEyeReport: false,
      hasBreachVipResults: false,
      breachVipCount: 0,
      csintCount: csint?.count ?? 0,
      breachHubCount: breachHub?.count ?? 0,
      osintCatCount: 0,
      godseyeSearchCount: godseyeSearch?.count ?? 0,
    };

    if (response.returned === 0) {
      return NextResponse.json({
        ...response,
        message: "No results were found.",
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        source: "Breached Data",
        query: email || query,
        totalMatches: 0,
        returned: 0,
        start,
        credentials: [],
        hasGodsEyeReport: false,
        hasBreachVipResults: false,
        breachVipCount: 0,
        csintCount: 0,
        breachHubCount: 0,
        osintCatCount: 0,
        godseyeSearchCount: 0,
      },
    });
  }
}
