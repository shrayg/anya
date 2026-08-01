import { NextRequest, NextResponse } from "next/server";

import { osintJson, requireOsintAccess } from "@/lib/osint-api-auth";
import {
  breachHubRowsToCredentials,
  fetchBreachHubAdditiveBreachSearch,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  searchBreachVipForEmail,
  searchBreachVipForField,
  type BreachVipField,
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
  shouldUseAdditiveBreachVip,
} from "@/lib/provider-dedupe";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  settleWithinBudget,
} from "@/lib/osint-search-guard";
import {
  filterBlacklistedCredentials,
  getCachedBlacklistSet,
  warmDataBlacklistCache,
} from "@/lib/data-blacklist";
import {
  mergeCombCredentialFields,
  normalizeEmail,
  searchProxynovaCombForEmail,
  type CombCredential,
  type CombSearchResult,
} from "@/lib/proxynova-comb";

/** Memory-safety ceiling only — never reintroduce 50/100 caps on paid indexes. */
const BREACH_FANOUT_MAX_ROWS = 250_000;
const COMBINED_GODSEYE_TIMEOUT_MS = 18_000;
const COMBINED_CSINT_TIMEOUT_MS = 28_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 48_000;
/** Leave headroom under the route deadline for Comb + BH large payloads. */
const BREACH_SETTLE_BUDGET_MS = OSINT_ROUTE_DEADLINE_MS - 3_000;
const COMB_BUDGET_MS = 48_000;

function credentialMergeKey(row: CombCredential): string {
  const id = row.identifier.toLowerCase();
  const secret = row.secret;
  // Passwordless rows from different dumps must stay distinct.
  if (!secret) {
    return `${id}\0\0${(row.raw ?? "").toLowerCase()}`;
  }

  return `${id}\0${secret}`;
}

function mergeCredentials(
  primary: CombCredential[],
  secondary: CombCredential[],
): CombCredential[] {
  const byKey = new Map<string, CombCredential>();

  for (const row of [...primary, ...secondary]) {
    const key = credentialMergeKey(row);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    // Prefer the richer hit when the same login:secret appears from multiple indexes.
    const fields = mergeCombCredentialFields(existing.fields, row.fields);
    const richerRaw =
      (row.raw?.length ?? 0) > (existing.raw?.length ?? 0) ? row.raw : existing.raw;

    byKey.set(key, {
      ...existing,
      raw: richerRaw,
      ...(fields ? { fields } : {}),
    });
  }

  return [...byKey.values()];
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

async function fetchBreachHubSafe(
  query: string,
  kindHint: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isBreachHubEnabled()) return null;

  try {
    return await fetchBreachHubAdditiveBreachSearch(
      query,
      kindHint,
      COMBINED_BREACHHUB_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

async function fetchCsintSafe(
  query: string,
  kindHint: string,
): Promise<SanitizedBreachResponse | null> {
  if (!isCsintEnabled()) return null;

  const csintType =
    kindHint === "email" ||
    kindHint === "phone" ||
    kindHint === "username" ||
    kindHint === "ip" ||
    kindHint === "auto"
      ? kindHint
      : detectCsintSearchType(query);

  try {
    return await fetchCsintAdditiveBreachSearch(
      query,
      csintType,
      COMBINED_CSINT_TIMEOUT_MS,
    );
  } catch {
    return null;
  }
}

/** BreachHub + CSINT both contribute — parallel additive, merge-deduped upstream. */
async function fetchBreachAndCsintParallel(
  query: string,
  kindHint: string,
): Promise<{
  breachHub: SanitizedBreachResponse | null;
  csint: SanitizedBreachResponse | null;
}> {
  const [breachHubSettled, csintSettled] = await Promise.allSettled([
    fetchBreachHubSafe(query, kindHint),
    fetchCsintSafe(query, kindHint),
  ]);

  return {
    breachHub: settledValue(breachHubSettled),
    csint: settledValue(csintSettled),
  };
}

function breachVipFieldForKind(kind: string): BreachVipField | null {
  switch (kind) {
    case "email":
      return "email";
    case "phone":
      return "phone";
    case "username":
      return "username";
    case "ip":
      return "ip";
    case "domain":
      return "domain";
    case "name":
      return "name";
    case "password":
      return "password";
    case "discord":
      return "discordid";
    default:
      return null;
  }
}

async function fetchBreachVipSafe(
  query: string,
  kindHint: string,
  email: string | null,
) {
  if (!shouldUseAdditiveBreachVip()) return null;

  try {
    if (email && (kindHint === "email" || kindHint === "auto")) {
      return await searchBreachVipForEmail(email, {
        maxRows: BREACH_FANOUT_MAX_ROWS,
      });
    }

    const field = breachVipFieldForKind(kindHint);

    if (!field) return null;

    return await searchBreachVipForField(query, field, {
      maxRows: BREACH_FANOUT_MAX_ROWS,
    });
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

      // Parallel additive: Comb + GodsEye + BreachVIP + BreachHub + CSINT.
      // settleWithinBudget keeps finished providers when Comb/BH run long —
      // withDeadline(allSettled) used to discard everything on one slow slot.
      const [
        combSettled,
        godseyeReportSettled,
        godseyeSearchSettled,
        breachVipSettled,
        gatewaySettled,
      ] = await settleWithinBudget(
        [
          searchProxynovaCombForEmail(email, {
            start,
            limit: Math.min(
              Math.max(1, limit),
              BREACH_FANOUT_MAX_ROWS,
            ),
            budgetMs: COMB_BUDGET_MS,
          }),
          fetchGodsEyeEmailReport(email),
          fetchGodsEyeSearchSafe(email, "email"),
          fetchBreachVipSafe(email, "email", email),
          fetchBreachAndCsintParallel(email, "email"),
        ],
        BREACH_SETTLE_BUDGET_MS,
        15_000,
      );

      const combResult = settledValue(combSettled) ?? emptyComb(email, start);
      const godseyeReport = settledValue(godseyeReportSettled);
      const godseyeSearch = settledValue(godseyeSearchSettled);
      const breachVip = settledValue(breachVipSettled);
      const gateway = settledValue(gatewaySettled);
      const breachHub = gateway?.breachHub ?? null;
      const csint = gateway?.csint ?? null;
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

      await warmDataBlacklistCache();
      const credentials = filterBlacklistedCredentials(
        mergedCredentials,
        getCachedBlacklistSet(),
      );

      const response = {
        ...combResult,
        // Honest UI count = merged credential rows, not provider index ads.
        totalMatches: credentials.length,
        returned: credentials.length,
        credentials,
        godseyeReport,
        hasGodsEyeReport: Boolean(godseyeReport),
        hasBreachVipResults: Boolean(breachVip && breachVip.returned > 0),
        breachVipCount: breachVip?.credentials?.length ?? 0,
        csintCount: csint?.results?.length ?? 0,
        breachHubCount: breachHub?.results?.length ?? 0,
        osintCatCount: osintCat?.results?.length ?? 0,
        godseyeSearchCount: godseyeSearch?.results?.length ?? 0,
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
        return osintJson(access, {
          ...response,
          message: "No results were found.",
        });
      }

      return osintJson(access, response);
    }

    // Username / phone / domain / free-text — BH ∥ CSINT ∥ BreachVIP + GodsEye.
    const resolvedKind =
      kindHint && kindHint !== "auto"
        ? kindHint
        : detectCsintSearchType(query);
    const [gatewaySettled, godseyeSearchSettled, breachVipSettled] =
      await settleWithinBudget(
        [
          fetchBreachAndCsintParallel(query, resolvedKind),
          fetchGodsEyeSearchSafe(query, resolvedKind),
          fetchBreachVipSafe(query, resolvedKind, null),
        ],
        BREACH_SETTLE_BUDGET_MS,
        15_000,
      );

    const gateway = settledValue(gatewaySettled);
    const breachHub = gateway?.breachHub ?? null;
    const csint = gateway?.csint ?? null;
    const godseyeSearch = settledValue(godseyeSearchSettled);
    const breachVip = settledValue(breachVipSettled);

    const mergedCredentials = [
      breachVip?.credentials ?? [],
      csint ? csintRowsToCredentials(csint.results) : [],
      breachHub ? breachHubRowsToCredentials(breachHub.results) : [],
      godseyeSearch ? breachHubRowsToCredentials(godseyeSearch.results) : [],
    ].reduce(
      (acc, next) => mergeCredentials(acc, next),
      [] as CombCredential[],
    );

    await warmDataBlacklistCache();
    const credentials = filterBlacklistedCredentials(
      mergedCredentials,
      getCachedBlacklistSet(),
    );

    const response = {
      ...emptyComb(query, start),
      totalMatches: credentials.length,
      returned: credentials.length,
      credentials,
      hasGodsEyeReport: false,
      hasBreachVipResults: Boolean(breachVip && breachVip.returned > 0),
      breachVipCount: breachVip?.credentials?.length ?? 0,
      csintCount: csint?.results?.length ?? 0,
      breachHubCount: breachHub?.results?.length ?? 0,
      osintCatCount: 0,
      godseyeSearchCount: godseyeSearch?.results?.length ?? 0,
    };

    if (response.returned === 0) {
      return osintJson(access, {
        ...response,
        message: "No results were found.",
      });
    }

    return osintJson(access, response);
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
