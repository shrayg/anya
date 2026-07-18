import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { searchBreachVipForEmail } from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  fetchCsintAdditiveBreachSearch,
} from "@/lib/csint";
import { fetchGodsEyeEmailReport } from "@/lib/godseye";
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
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  try {
    const [combSettled, godseyeSettled, breachVipSettled, csintSettled] =
      await withDeadline(
        Promise.allSettled([
          searchProxynovaCombForEmail(email, { start, limit }),
          fetchGodsEyeEmailReport(email),
          searchBreachVipForEmail(email, { maxRows: limit }),
          fetchCsintAdditiveBreachSearch(email, "email", 15_000),
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
    const godseyeReport = settledValue(godseyeSettled);
    const breachVip = settledValue(breachVipSettled);
    const csint = settledValue(csintSettled);

    const csintCredentials = csint
      ? csintRowsToCredentials(csint.results)
      : [];

    const mergedCredentials = mergeCredentials(
      mergeCredentials(combResult.credentials, breachVip?.credentials ?? []),
      csintCredentials,
    );

    const breachVipExtra = breachVip?.totalMatches ?? 0;
    const csintExtra = csint?.count ?? 0;
    const merged: CombSearchResult = {
      ...combResult,
      totalMatches: combResult.totalMatches + breachVipExtra + csintExtra,
      returned: mergedCredentials.length,
      credentials: mergedCredentials,
    };

    const response = {
      ...merged,
      godseyeReport,
      hasGodsEyeReport: Boolean(godseyeReport),
      hasBreachVipResults: Boolean(breachVip && breachVip.returned > 0),
      breachVipCount: breachVip?.totalMatches ?? 0,
    };

    if (
      merged.returned === 0 &&
      !godseyeReport &&
      !(breachVip && breachVip.returned > 0) &&
      !csintExtra
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
      },
    });
  }
}
