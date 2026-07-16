import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { searchBreachVipForEmail } from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  fetchCsintUniversalSearch,
} from "@/lib/csint";
import { fetchGodsEyeEmailReport } from "@/lib/godseye";
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

  const [combResult, godseyeReport, breachVip, csint] = await Promise.all([
    searchProxynovaCombForEmail(email, { start, limit }),
    fetchGodsEyeEmailReport(email),
    searchBreachVipForEmail(email, { maxRows: limit }),
    fetchCsintUniversalSearch(email, "email", 15_000),
  ]);

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
}
