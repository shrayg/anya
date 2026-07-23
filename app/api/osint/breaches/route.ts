import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  breachHubRowsToCredentials,
  fetchBreachHubAdditiveBreachSearch,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  searchBreachVipForEmail,
} from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  detectCsintSearchType,
  fetchCsintAdditiveBreachSearch,
  isCsintEnabled,
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
  type SanitizedBreachResponse,
} from "@/lib/osintcat";
import {
  hasOsintCatDirect,
  isBreachHubPrimaryActive,
  shouldUseDirectBreachVip,
  withPrimaryFallback,
} from "@/lib/provider-dedupe";
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

/** Memory-safety ceiling only — never reintroduce 50/100 caps on paid indexes. */
const BREACH_FANOUT_MAX_ROWS = 250_000;
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

/** BreachHub additive first; CSINT only after BH miss. */
async function fetchBreachThenCsint(
  query: string,
  kindHint: string,
): Promise<{
  breachHub: SanitizedBreachResponse | null;
  csint: SanitizedBreachResponse | null;
}> {
  const csintType =
    kindHint === "email" ||
    kindHint === "phone" ||
    kindHint === "username" ||
    kindHint === "ip" ||
    kindHint === "auto"
      ? kindHint
      : detectCsintSearchType(query);

  const { value, used } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;

      return fetchBreachHubAdditiveBreachSearch(
        query,
        kindHint,
        COMBINED_BREACHHUB_TIMEOUT_MS,
      );
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintAdditiveBreachSearch(
        query,
        csintType,
        COMBINED_CSINT_TIMEOUT_MS,
      );
    },
    (row) => Boolean(row && row.count > 0),
  );

  if (used === "primary") {
    return { breachHub: value, csint: null };
  }

  if (used === "fallback") {
    return { breachHub: null, csint: value };
  }

  return { breachHub: null, csint: null };
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
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? BREACH_FANOUT_MAX_ROWS);
  // Field-type hint from the Breaches UI (email / username / phone / …).
  const typeRaw = req.nextUrl.searchParams.get("type")?.trim().toLowerCase() ?? "";
  const kindHint =
    typeRaw === "email" ||
    typeRaw === "phone" ||
    typeRaw === "username" ||
    typeRaw === "ip" ||
    typeRaw === "domain" ||
    typeRaw === "hash" ||
    typeRaw === "password" ||
    typeRaw === "discord" ||
    typeRaw === "name" ||
    typeRaw === "url" ||
    typeRaw === "crypto" ||
    typeRaw === "auto"
      ? typeRaw
      : null;

  try {
    const preferEmail =
      kindHint === "email" || ((!kindHint || kindHint === "auto") && Boolean(email));

    if (preferEmail) {
      if (!email) {
        return NextResponse.json(
          { error: "Enter a valid email address." },
          { status: 400 },
        );
      }

      // Parallel: Comb + GodsEye (+ BreachVIP only when BH is off).
      // Sequential: BreachHub → CSINT; OsintCat direct only after BH miss.
      const [
        combSettled,
        godseyeReportSettled,
        godseyeSearchSettled,
        breachVipSettled,
        gatewaySettled,
      ] = await withDeadline(
        Promise.allSettled([
          searchProxynovaCombForEmail(email, {
            start,
            limit: Math.min(
              Math.max(1, limit),
              BREACH_FANOUT_MAX_ROWS,
            ),
          }),
          fetchGodsEyeEmailReport(email),
          fetchGodsEyeSearchSafe(email, "email"),
          shouldUseDirectBreachVip()
            ? searchBreachVipForEmail(email, {
                maxRows: BREACH_FANOUT_MAX_ROWS,
              })
            : Promise.resolve(null),
          fetchBreachThenCsint(email, "email"),
        ]),
        OSINT_ROUTE_DEADLINE_MS,
      );

      const combResult = settledValue(combSettled) ?? emptyComb(email, start);
      const godseyeReport = settledValue(godseyeReportSettled);
      const godseyeSearch = settledValue(godseyeSearchSettled);
      const breachVip = settledValue(breachVipSettled);
      const gateway = settledValue(gatewaySettled);
      const breachHub = gateway?.breachHub ?? null;
      let csint = gateway?.csint ?? null;
      let osintCat: SanitizedBreachResponse | null = null;

      // OsintCat: BH primary already includes osintcat-* when BH is up.
      // Direct OsintCat only when BH is off, or as fallback after empty BH+CSINT.
      if (shouldUseDirectOsintCatParallelSafe()) {
        osintCat = await fetchOsintCatBreachSafe(email);
      } else if (
        isBreachHubPrimaryActive() &&
        hasOsintCatDirect() &&
        !(breachHub && breachHub.count > 0) &&
        !(csint && csint.count > 0)
      ) {
        osintCat = await fetchOsintCatBreachSafe(email);
      }

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

    // Username / phone / domain / free-text — BH→CSINT sequential + GodsEye.
    const resolvedKind =
      kindHint && kindHint !== "auto"
        ? kindHint
        : detectCsintSearchType(query);
    const [gatewaySettled, godseyeSearchSettled] = await withDeadline(
      Promise.allSettled([
        fetchBreachThenCsint(query, resolvedKind),
        fetchGodsEyeSearchSafe(query, resolvedKind),
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

    const gateway = settledValue(gatewaySettled);
    const breachHub = gateway?.breachHub ?? null;
    const csint = gateway?.csint ?? null;
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

function shouldUseDirectOsintCatParallelSafe(): boolean {
  return hasOsintCatDirect() && !isBreachHubPrimaryActive();
}
