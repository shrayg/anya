import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  breachHubRowsToCredentials,
  fetchBreachHubAdditiveBreachSearch,
} from "@/lib/breachhub";
import { searchBreachVipForEmail } from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  fetchCsintAdditiveBreachSearch,
} from "@/lib/csint";
import {
  fetchGodsEyeEmailReport,
  fetchGodsEyeSearchResult,
} from "@/lib/godseye";
import {
  fetchOsintCatBreach,
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
  try {
    return sanitizeBreachResponse(await fetchOsintCatBreach(email));
  } catch {
    return null;
  }
}

async function fetchGodsEyeEmailSearchSafe(email: string) {
  try {
    return await fetchGodsEyeSearchResult(
      "email",
      email,
      COMBINED_GODSEYE_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breaches");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const email = normalizeEmail(query);

  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const start = Number(req.nextUrl.searchParams.get("start") ?? 0);
  // ProxyNova comb API hard-caps at 100; other providers use BREACH_FANOUT_MAX_ROWS.
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  try {
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
        fetchGodsEyeEmailSearchSafe(email),
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

    const combResult = settledValue(combSettled) ?? {
      query: email,
      totalMatches: 0,
      returned: 0,
      start,
      credentials: [] as CombCredential[],
      source: "Breached Data",
    };
    const godseyeReport = settledValue(godseyeReportSettled);
    const godseyeSearch = settledValue(godseyeSearchSettled);
    const breachVip = settledValue(breachVipSettled);
    const csint = settledValue(csintSettled);
    const breachHub = settledValue(breachHubSettled);
    const osintCat = settledValue(osintCatSettled);

    const godseyeCredentials = godseyeSearch
      ? breachHubRowsToCredentials(godseyeSearch.results)
      : [];
    const csintCredentials = csint ? csintRowsToCredentials(csint.results) : [];
    const breachHubCredentials = breachHub
      ? breachHubRowsToCredentials(breachHub.results)
      : [];
    const osintCatCredentials = osintCat
      ? breachHubRowsToCredentials(osintCat.results)
      : [];

    const mergedCredentials = [
      combResult.credentials,
      breachVip?.credentials ?? [],
      godseyeCredentials,
      csintCredentials,
      breachHubCredentials,
      osintCatCredentials,
    ].reduce((acc, next) => mergeCredentials(acc, next), [] as CombCredential[]);

    const breachVipExtra = breachVip?.totalMatches ?? 0;
    const godseyeExtra = godseyeSearch?.count ?? 0;
    const csintExtra = csint?.count ?? 0;
    const breachHubExtra = breachHub?.count ?? 0;
    const osintCatExtra = osintCat?.count ?? 0;
    const merged: CombSearchResult = {
      ...combResult,
      totalMatches:
        combResult.totalMatches +
        breachVipExtra +
        godseyeExtra +
        csintExtra +
        breachHubExtra +
        osintCatExtra,
      returned: mergedCredentials.length,
      credentials: mergedCredentials,
    };

    const response = {
      ...merged,
      godseyeReport,
      hasGodsEyeReport: Boolean(godseyeReport),
      hasBreachVipResults: Boolean(breachVip && breachVip.returned > 0),
      breachVipCount: breachVip?.totalMatches ?? 0,
      csintCount: csintExtra,
      breachHubCount: breachHubExtra,
      osintCatCount: osintCatExtra,
      godseyeSearchCount: godseyeExtra,
    };

    if (
      merged.returned === 0 &&
      !godseyeReport &&
      !(breachVip && breachVip.returned > 0) &&
      !csintExtra &&
      !breachHubExtra &&
      !osintCatExtra &&
      !godseyeExtra
    ) {
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
        query: email,
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
