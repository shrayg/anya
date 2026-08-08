/**
 * Breaches OSINT fan-out — BreachHub-first, CSINT deferred, progressive assembly.
 *
 * Fast peers (Comb / GodsEye / BreachVIP / BreachHub) run in parallel and emit
 * partial snapshots as each settles. CSINT runs only after BreachHub settles
 * when BH is empty/thin (or BH is off) — keeps the shared CSINT serial gate
 * cooler than always-additive parallel hammering.
 *
 * Server-only — do not import from client modules.
 */

import {
  breachHubRowsToCredentials,
  detectBreachHubQueryKind,
  fetchBreachHubAdditiveBreachSearch,
  isBreachHubCoolingDown,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  canContributeOathnet,
  fetchOathnetSanitized,
} from "@/lib/oathnet";
import type { PlanId } from "@/lib/plans";
import {
  searchBreachVipForEmail,
  searchBreachVipForField,
  type BreachVipField,
} from "@/lib/breachvip";
import {
  csintRowsToCredentials,
  detectCsintSearchType,
  fetchCsintAdditiveBreachSearch,
  isCsintCoolingDown,
  isCsintEnabled,
} from "@/lib/csint";
import {
  filterBlacklistedCredentials,
  getCachedBlacklistSet,
  warmDataBlacklistCache,
} from "@/lib/data-blacklist";
import { normalizeDomain } from "@/lib/domain-search";
import {
  fetchGodsEyeEmailReport,
  fetchGodsEyeSearchResult,
  resolveGodsEyeSearchType,
  type GodsEyeResponse,
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
  mergeCombCredentialFields,
  normalizeEmail,
  searchProxynovaCombForDomain,
  searchProxynovaCombForEmail,
  type CombCredential,
  type CombSearchResult,
} from "@/lib/proxynova-comb";

/** Memory-safety ceiling only — never reintroduce 50/100 caps on paid indexes. */
export const BREACH_FANOUT_MAX_ROWS = 250_000;

const COMBINED_GODSEYE_TIMEOUT_MS = 18_000;
const COMBINED_CSINT_TIMEOUT_MS = 28_000;
const COMBINED_BREACHHUB_TIMEOUT_MS = 48_000;
const COMB_BUDGET_MS = 48_000;

/**
 * When BreachHub returns fewer than this many *actual rows*, still ask CSINT.
 * Use real results.length (not advertised totals) so a thin BH page cannot
 * skip the fallback. Above this, skip CSINT (BH already covered the indexes).
 */
const BH_THIN_THRESHOLD = 50;

export type BreachesOsintResult = CombSearchResult & {
  godseyeReport?: GodsEyeResponse | null;
  hasGodsEyeReport: boolean;
  hasBreachVipResults: boolean;
  breachVipCount: number;
  csintCount: number;
  breachHubCount: number;
  osintCatCount: number;
  godseyeSearchCount: number;
  /** Present when BreachHub was skipped or aborted due to account rate limit. */
  breachHubRateLimited?: boolean;
};

export type BreachesOsintProgressEvent =
  | {
      type: "partial";
      module: string;
      done: number;
      total: number;
      result: BreachesOsintResult;
    }
  | { type: "done"; result: BreachesOsintResult };

export type BreachesOsintSearchOpts = {
  start?: number;
  limit?: number;
  kindHint?: string | null;
  /** Ultimate+ native OathNet breach (+ Holehe/GHunt for email). */
  includeOathnet?: boolean;
  plan?: PlanId | null;
};

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
  // Fail fast while account-blocked — never burn the remaining cooldown.
  if (isBreachHubCoolingDown()) return null;

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
  if (!isCsintEnabled() || isCsintCoolingDown()) return null;
  // CSINT has no domain type — never fall through to username for domains.
  if (kindHint === "domain" || normalizeDomain(query)) return null;

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

/** Resolve breach kind, soft-correcting username→domain auto-detect fallout. */
function resolveBreachKindHint(
  query: string,
  kindHint: string | null,
): string {
  if (kindHint && kindHint !== "auto") {
    if (kindHint === "username" && normalizeDomain(query)) {
      return "domain";
    }

    return kindHint;
  }

  return detectBreachHubQueryKind(query);
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

/**
 * CSINT only when BreachHub is off, cooling down, failed, empty, or thin —
 * not every search. Keeps the shared serial CSINT gate cool while preserving
 * fallback coverage when BH cannot deliver volume.
 */
export function shouldRunCsintAfterBreachHub(
  breachHub: SanitizedBreachResponse | null,
): boolean {
  if (!isCsintEnabled() || isCsintCoolingDown()) return false;

  if (!isBreachHubPrimaryActive() || !isBreachHubEnabled()) return true;

  // BH account rate-limit → CSINT is the volume path until cooldown lifts.
  if (isBreachHubCoolingDown()) return true;

  // Honest row count — never trust advertised found_total / index ads.
  const rows = breachHub?.results?.length ?? 0;

  return rows < BH_THIN_THRESHOLD;
}

function shouldUseDirectOsintCatParallelSafe(): boolean {
  return hasOsintCatDirect() && !isBreachHubPrimaryActive();
}

function shouldRunOsintCatFallback(
  breachHub: SanitizedBreachResponse | null,
  csint: SanitizedBreachResponse | null,
): boolean {
  if (!hasOsintCatDirect()) return false;
  if (shouldUseDirectOsintCatParallelSafe()) return true;

  return (
    isBreachHubPrimaryActive() &&
    !(breachHub && breachHub.count > 0) &&
    !(csint && csint.count > 0)
  );
}

/**
 * Run the Breaches fan-out. Calls `onEvent` as each module settles so callers
 * can stream NDJSON / update UI progressively.
 */
export async function runBreachesOsintSearch(
  rawQuery: string,
  opts: BreachesOsintSearchOpts = {},
  onEvent?: (event: BreachesOsintProgressEvent) => void,
): Promise<BreachesOsintResult> {
  const query = rawQuery.trim();
  const start = opts.start ?? 0;
  const limit = Math.min(
    Math.max(1, opts.limit ?? BREACH_FANOUT_MAX_ROWS),
    BREACH_FANOUT_MAX_ROWS,
  );
  const kindHint = opts.kindHint ?? null;
  const email = normalizeEmail(query);
  const preferEmail =
    kindHint === "email" ||
    ((!kindHint || kindHint === "auto") && Boolean(email));

  if (preferEmail && !email) {
    throw new Error("Enter a valid email address.");
  }

  await warmDataBlacklistCache();

  let combCredentials: CombCredential[] = [];
  let breachVipCredentials: CombCredential[] = [];
  let godseyeSearch: SanitizedBreachResponse | null = null;
  let godseyeReport: GodsEyeResponse | null = null;
  let breachHub: SanitizedBreachResponse | null = null;
  let csint: SanitizedBreachResponse | null = null;
  let osintCat: SanitizedBreachResponse | null = null;
  let oathnet: SanitizedBreachResponse | null = null;
  let breachVipReturned = 0;

  let doneCount = 0;
  // Email: comb + godseye-report + godseye-search + breachvip + breachhub (+ CSINT/OsintCat later).
  // Domain: comb + godseye-search + breachvip + breachhub (CSINT skipped — no domain type).
  // Other: godseye-search + breachvip + breachhub (+ CSINT later).
  const initialDomain = resolveBreachKindHint(query, kindHint) === "domain";
  let moduleTotal = preferEmail ? 5 : initialDomain ? 4 : 3;
  const includeOathnet =
    opts.includeOathnet === true ||
    (opts.plan ? canContributeOathnet(opts.plan) : false);

  if (includeOathnet) moduleTotal += 1;

  const assemble = (): BreachesOsintResult => {
    const mergedCredentials = [
      combCredentials,
      breachVipCredentials,
      godseyeSearch ? breachHubRowsToCredentials(godseyeSearch.results) : [],
      csint ? csintRowsToCredentials(csint.results) : [],
      breachHub ? breachHubRowsToCredentials(breachHub.results) : [],
      osintCat ? breachHubRowsToCredentials(osintCat.results) : [],
      oathnet ? breachHubRowsToCredentials(oathnet.results) : [],
    ].reduce(
      (acc, next) => mergeCredentials(acc, next),
      [] as CombCredential[],
    );

    const credentials = filterBlacklistedCredentials(
      mergedCredentials,
      getCachedBlacklistSet(),
    );

    return {
      ...(preferEmail && email
        ? {
            query: email,
            totalMatches: credentials.length,
            returned: credentials.length,
            start,
            credentials,
            source: "Breached Data",
          }
        : {
            ...emptyComb(query, start),
            totalMatches: credentials.length,
            returned: credentials.length,
            credentials,
          }),
      godseyeReport,
      hasGodsEyeReport: Boolean(godseyeReport),
      hasBreachVipResults: breachVipReturned > 0,
      breachVipCount: breachVipCredentials.length,
      csintCount: csint?.results?.length ?? 0,
      breachHubCount: breachHub?.results?.length ?? 0,
      osintCatCount: osintCat?.results?.length ?? 0,
      godseyeSearchCount: godseyeSearch?.results?.length ?? 0,
      breachHubRateLimited: isBreachHubCoolingDown(),
    };
  };

  const emit = (module: string) => {
    doneCount += 1;
    onEvent?.({
      type: "partial",
      module,
      done: doneCount,
      total: moduleTotal,
      result: assemble(),
    });
  };

  const bumpTotal = () => {
    moduleTotal += 1;
  };

  if (preferEmail && email) {
    const peerTasks: Promise<void>[] = [
      searchProxynovaCombForEmail(email, {
        start,
        limit,
        budgetMs: COMB_BUDGET_MS,
      })
        .then((comb) => {
          combCredentials = comb.credentials ?? [];
          emit("comb");
        })
        .catch(() => {
          combCredentials = [];
          emit("comb");
        }),

      fetchGodsEyeEmailReport(email)
        .then((report) => {
          godseyeReport = report;
          emit("godseye-report");
        })
        .catch(() => {
          godseyeReport = null;
          emit("godseye-report");
        }),

      fetchGodsEyeSearchSafe(email, "email")
        .then((search) => {
          godseyeSearch = search;
          emit("godseye-search");
        })
        .catch(() => {
          godseyeSearch = null;
          emit("godseye-search");
        }),

      fetchBreachVipSafe(email, "email", email)
        .then((vip) => {
          breachVipCredentials = vip?.credentials ?? [];
          breachVipReturned = vip?.returned ?? 0;
          emit("breachvip");
        })
        .catch(() => {
          breachVipCredentials = [];
          breachVipReturned = 0;
          emit("breachvip");
        }),
    ];

    // BreachHub first among the heavy indexes — decide CSINT from its outcome.
    const bhTask = fetchBreachHubSafe(email, "email")
      .then((bh) => {
        breachHub = bh;
        emit("breachhub");
      })
      .catch(() => {
        breachHub = null;
        emit("breachhub");
      });

    await bhTask;

    const followUps: Promise<void>[] = [];

    if (shouldRunCsintAfterBreachHub(breachHub)) {
      bumpTotal();
      followUps.push(
        fetchCsintSafe(email, "email")
          .then((data) => {
            csint = data;
            emit("csint");
          })
          .catch(() => {
            csint = null;
            emit("csint");
          }),
      );
    }

    // Wait for CSINT (if any) before OsintCat empty-fallback decision.
    if (followUps.length > 0) {
      await Promise.all(followUps);
    }

    if (shouldRunOsintCatFallback(breachHub, csint)) {
      bumpTotal();
      await fetchOsintCatBreachSafe(email)
        .then((data) => {
          osintCat = data;
          emit("osintcat");
        })
        .catch(() => {
          osintCat = null;
          emit("osintcat");
        });
    }

    await Promise.all(peerTasks);
  } else {
    const resolvedKind = resolveBreachKindHint(query, kindHint);
    const isDomainKind = resolvedKind === "domain";

    // CSINT has no domain type — never mis-search domains as username.
    const peerTasks: Promise<void>[] = [];

    if (isDomainKind) {
      peerTasks.push(
        searchProxynovaCombForDomain(query, {
          start,
          limit,
          budgetMs: COMB_BUDGET_MS,
        })
          .then((comb) => {
            combCredentials = comb.credentials ?? [];
            emit("comb");
          })
          .catch(() => {
            combCredentials = [];
            emit("comb");
          }),
      );
    }

    peerTasks.push(
      fetchGodsEyeSearchSafe(query, resolvedKind)
        .then((search) => {
          godseyeSearch = search;
          emit("godseye-search");
        })
        .catch(() => {
          godseyeSearch = null;
          emit("godseye-search");
        }),

      fetchBreachVipSafe(query, resolvedKind, null)
        .then((vip) => {
          breachVipCredentials = vip?.credentials ?? [];
          breachVipReturned = vip?.returned ?? 0;
          emit("breachvip");
        })
        .catch(() => {
          breachVipCredentials = [];
          breachVipReturned = 0;
          emit("breachvip");
        }),
    );

    const bhTask = fetchBreachHubSafe(query, resolvedKind)
      .then((bh) => {
        breachHub = bh;
        emit("breachhub");
      })
      .catch(() => {
        breachHub = null;
        emit("breachhub");
      });

    await bhTask;

    if (!isDomainKind && shouldRunCsintAfterBreachHub(breachHub)) {
      bumpTotal();
      await fetchCsintSafe(query, resolvedKind)
        .then((data) => {
          csint = data;
          emit("csint");
        })
        .catch(() => {
          csint = null;
          emit("csint");
        });
    }

    await Promise.all(peerTasks);
  }

  if (includeOathnet) {
    try {
      const jobs: Array<Promise<SanitizedBreachResponse | null>> = [
        fetchOathnetSanitized(
          { kind: "static", endpoint: "breach" },
          { query: preferEmail && email ? email : query },
        ).catch(() => null),
      ];

      if (preferEmail && email) {
        jobs.push(
          fetchOathnetSanitized(
            { kind: "static", endpoint: "holehe" },
            { email },
          ).catch(() => null),
          fetchOathnetSanitized(
            { kind: "static", endpoint: "ghunt" },
            { email },
          ).catch(() => null),
        );
      }

      const settled = await Promise.all(jobs);
      const parts = settled.filter(
        (part): part is SanitizedBreachResponse =>
          Boolean(part && (part.count > 0 || (part.results?.length ?? 0) > 0)),
      );

      if (parts.length > 0) {
        oathnet = {
          count: parts.reduce((sum, part) => sum + (part.count || 0), 0),
          results: parts.flatMap((part) =>
            Array.isArray(part.results) ? part.results : [],
          ),
        };
      }
    } catch {
      oathnet = null;
    }
    emit("oathnet");
  }

  const finalResult = assemble();

  if (
    finalResult.returned === 0 &&
    !finalResult.hasGodsEyeReport &&
    !finalResult.hasBreachVipResults &&
    !finalResult.csintCount &&
    !finalResult.breachHubCount &&
    !finalResult.osintCatCount &&
    !finalResult.godseyeSearchCount
  ) {
    finalResult.message = isBreachHubCoolingDown()
      ? "BreachHub is rate-limited right now. Try again in a few minutes."
      : "No results were found.";
  } else if (
    isBreachHubCoolingDown() &&
    !finalResult.breachHubCount &&
    finalResult.returned > 0
  ) {
    finalResult.message =
      "BreachHub is rate-limited; showing Comb / CSINT / other sources only.";
  }

  onEvent?.({ type: "done", result: finalResult });

  return finalResult;
}
